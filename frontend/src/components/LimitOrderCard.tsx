"use client";

import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseUnits } from "viem";

const LIMIT_ORDER_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenIn", type: "address" },
      { internalType: "address", name: "tokenOut", type: "address" },
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "createOrder",
    outputs: [{ internalType: "uint256", name: "orderId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "orderId", type: "uint256" }],
    name: "cancelOrder",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "orderId", type: "uint256" }],
    name: "fillOrderDirect",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
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

const ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_LIMIT_ORDER_ADDRESS || "0x0000000000000000000000000000000000000000";

export function LimitOrderCard() {
  const { address } = useAccount();
  const [tokenIn, setTokenIn] = useState("");
  const [tokenOut, setTokenOut] = useState("");
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [durationHours, setDurationHours] = useState("24");

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleApprove = () => {
    if (!tokenIn || !amountIn) return;
    writeContract({
      address: tokenIn as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [VAULT_ADDRESS as `0x${string}`, parseUnits(amountIn, 18)],
    });
  };

  const handleCreate = () => {
    if (!tokenIn || !tokenOut || !amountIn || !amountOut) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(durationHours) * 3600);
    writeContract({
      address: VAULT_ADDRESS as `0x${string}`,
      abi: LIMIT_ORDER_ABI,
      functionName: "createOrder",
      args: [
        tokenIn as `0x${string}`,
        tokenOut as `0x${string}`,
        parseUnits(amountIn, 18),
        parseUnits(amountOut, 18),
        deadline,
      ],
    });
  };

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Limit Order</h2>
      <p className="text-zinc-500 text-sm mb-6">
        Place a limit order that can be filled when the market price reaches your target.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Token In Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={tokenIn}
            onChange={(e) => setTokenIn(e.target.value)}
            className="w-full bg-zinc-800/50 rounded-xl p-3 text-white text-sm outline-none placeholder-zinc-600"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Token Out Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
            className="w-full bg-zinc-800/50 rounded-xl p-3 text-white text-sm outline-none placeholder-zinc-600"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Amount In</label>
          <input
            type="number"
            placeholder="0.0"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            className="w-full bg-zinc-800/50 rounded-xl p-3 text-white text-sm outline-none placeholder-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Amount Out (minimum you want to receive)</label>
          <input
            type="number"
            placeholder="0.0"
            value={amountOut}
            onChange={(e) => setAmountOut(e.target.value)}
            className="w-full bg-zinc-800/50 rounded-xl p-3 text-white text-sm outline-none placeholder-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Duration (hours)</label>
          <select
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            className="w-full bg-zinc-800 text-white text-sm px-3 py-3 rounded-xl outline-none cursor-pointer"
          >
            <option value="1">1 hour</option>
            <option value="6">6 hours</option>
            <option value="24">24 hours</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
          </select>
        </div>
      </div>

      {isSuccess && (
        <div className="mt-3 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400 text-sm text-center">
          Order created!
        </div>
      )}

      {!address ? (
        <div className="mt-4 flex justify-center">
          <ConnectButton />
        </div>
      ) : (
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleApprove}
            disabled={isPending || isConfirming}
            className="flex-1 py-3 rounded-xl bg-zinc-700 text-white font-medium hover:bg-zinc-600 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={handleCreate}
            disabled={isPending || isConfirming}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {isPending ? "Confirm..." : isConfirming ? "Creating..." : "Create Order"}
          </button>
        </div>
      )}
    </div>
  );
}
