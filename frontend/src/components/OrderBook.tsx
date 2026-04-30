"use client";

import { useAccount, useReadContract } from "wagmi";
import { useState, useMemo } from "react";
import { useFetchOrderBook, useOrderBook, type PriceLevel, type OrderBookUpdate } from "@/lib/useOrderBook";
import { COMMON_TOKENS } from "@/lib/tokens";

const LIMIT_ORDER_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "orders",
    outputs: [
      { internalType: "address", name: "maker", type: "address" },
      { internalType: "address", name: "tokenIn", type: "address" },
      { internalType: "address", name: "tokenOut", type: "address" },
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "bool", name: "filled", type: "bool" },
      { internalType: "bool", name: "cancelled", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextOrderId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_LIMIT_ORDER_ADDRESS || "0x0000000000000000000000000000000000000000";

function DepthBar({ level, maxAmount, side }: { level: PriceLevel; maxAmount: number; side: "bid" | "ask" }) {
  const pct = maxAmount > 0 ? (parseFloat(level.amount) / maxAmount) * 100 : 0;
  const barColor = side === "bid" ? "bg-green-500/20" : "bg-red-500/20";
  const textColor = side === "bid" ? "text-green-400" : "text-red-400";

  return (
    <div className="relative flex items-center px-3 py-1 text-xs font-mono">
      <div
        className={`absolute inset-y-0 ${side === "bid" ? "right-0" : "left-0"} ${barColor}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
      <span className={`relative z-10 w-28 ${textColor}`}>{level.price}</span>
      <span className="relative z-10 w-24 text-zinc-300">{parseFloat(level.amount).toFixed(4)}</span>
      <span className="relative z-10 w-12 text-zinc-500">{level.count}</span>
    </div>
  );
}

function OrderBookTable({
  orderBook,
  loading,
}: {
  orderBook: OrderBookUpdate | null;
  loading: boolean;
}) {
  const maxBidAmount = useMemo(() => {
    if (!orderBook?.bids.length) return 0;
    return Math.max(...orderBook.bids.map((b) => parseFloat(b.amount)));
  }, [orderBook?.bids]);

  const maxAskAmount = useMemo(() => {
    if (!orderBook?.asks.length) return 0;
    return Math.max(...orderBook.asks.map((a) => parseFloat(a.amount)));
  }, [orderBook?.asks]);

  if (loading && !orderBook) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
        Loading order book...
      </div>
    );
  }

  if (!orderBook || (orderBook.bids.length === 0 && orderBook.asks.length === 0)) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
        No open orders for this pair
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center px-3 py-1 text-[10px] text-zinc-600 uppercase tracking-wider border-b border-zinc-800">
        <span className="w-28">Price</span>
        <span className="w-24">Amount</span>
        <span className="w-12">Orders</span>
      </div>

      {orderBook.asks.length > 0 && (
        <div className="space-y-0">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-1 flex items-center">
            <span className="text-red-400">Asks (Sell)</span>
          </div>
          {[...orderBook.asks].reverse().map((level, i) => (
            <DepthBar key={`ask-${i}`} level={level} maxAmount={maxAskAmount} side="ask" />
          ))}
        </div>
      )}

      <div className="border-y border-zinc-800 py-2 px-3">
        <span className="text-zinc-400 text-xs font-mono">
          Spread: {calculateSpread(orderBook)}
        </span>
      </div>

      {orderBook.bids.length > 0 && (
        <div className="space-y-0">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-1 flex items-center">
            <span className="text-green-400">Bids (Buy)</span>
          </div>
          {orderBook.bids.map((level, i) => (
            <DepthBar key={`bid-${i}`} level={level} maxAmount={maxBidAmount} side="bid" />
          ))}
        </div>
      )}
    </div>
  );
}

function calculateSpread(ob: OrderBookUpdate | null): string {
  if (!ob || ob.asks.length === 0 || ob.bids.length === 0) return "-";
  const bestAsk = parseFloat(ob.asks[0].price);
  const bestBid = parseFloat(ob.bids[0].price);
  if (bestAsk === 0) return "-";
  const spread = ((bestAsk - bestBid) / bestAsk) * 100;
  return `${spread.toFixed(4)}%`;
}

export function OrderBook() {
  const { chain } = useAccount();
  const chainId = chain?.id ?? 31337;
  const tokens = COMMON_TOKENS[chainId] || [];

  const [tokenInIdx, setTokenInIdx] = useState(0);
  const [tokenOutIdx, setTokenOutIdx] = useState(tokens.length > 1 ? 1 : 0);

  const selectedTokenIn = tokens[tokenInIdx]?.address;
  const selectedTokenOut = tokens[tokenOutIdx]?.address;

  const { orderBook: wsOrderBook, connected } = useOrderBook(selectedTokenIn, selectedTokenOut);
  const { orderBook: fetchOrderBook, loading } = useFetchOrderBook(selectedTokenIn, selectedTokenOut);

  const activeOrderBook = wsOrderBook || fetchOrderBook;

  const { data: nextOrderId } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: LIMIT_ORDER_ABI,
    functionName: "nextOrderId",
    chainId,
  });

  const totalOrders = nextOrderId ? Number(nextOrderId) : 0;

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Order Book</h2>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-zinc-600"}`} />
          <span className="text-[10px] text-zinc-500">{connected ? "Live" : "Polling"}</span>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <select
          value={tokenInIdx}
          onChange={(e) => setTokenInIdx(Number(e.target.value))}
          className="flex-1 bg-zinc-800 text-white text-xs px-2 py-1.5 rounded-lg outline-none cursor-pointer"
        >
          {tokens.map((t, i) => (
            <option key={i} value={i}>{t.symbol}</option>
          ))}
          {tokens.length === 0 && <option value={0}>No tokens</option>}
        </select>
        <span className="text-zinc-500 self-center text-xs">/</span>
        <select
          value={tokenOutIdx}
          onChange={(e) => setTokenOutIdx(Number(e.target.value))}
          className="flex-1 bg-zinc-800 text-white text-xs px-2 py-1.5 rounded-lg outline-none cursor-pointer"
        >
          {tokens.map((t, i) => (
            <option key={i} value={i}>{t.symbol}</option>
          ))}
          {tokens.length === 0 && <option value={0}>No tokens</option>}
        </select>
      </div>

      {selectedTokenIn && selectedTokenOut ? (
        <OrderBookTable orderBook={activeOrderBook ?? null} loading={loading} />
      ) : (
        <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
          Select a token pair to view the order book
        </div>
      )}

      {totalOrders > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800 text-[10px] text-zinc-500 flex justify-between">
          <span>Total orders on vault: {totalOrders}</span>
          <span>Bids: {activeOrderBook?.bids.length ?? 0} | Asks: {activeOrderBook?.asks.length ?? 0}</span>
        </div>
      )}
    </div>
  );
}
