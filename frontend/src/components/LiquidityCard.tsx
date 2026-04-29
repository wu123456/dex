"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useState, useMemo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  DEX_FACTORY_ABI,
  DEX_FACTORY_ADDRESS,
  DEX_ROUTER_ABI,
  DEX_ROUTER_ADDRESS,
  DEX_PAIR_ABI,
  ERC20_ABI,
} from "@/lib/contracts";
import { getTokensForChain } from "@/lib/tokens";

interface TokenData {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
}

type Tab = "add" | "remove";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

function getDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 1200);
}

export function LiquidityCard() {
  const { address, chainId } = useAccount();
  const tokens = getTokensForChain(chainId || 31337);

  const [tab, setTab] = useState<Tab>("add");
  const [tokenAIdx, setTokenAIdx] = useState(0);
  const [tokenBIdx, setTokenBIdx] = useState(tokens.length > 1 ? 1 : 0);
  const [amountA, setAmountA] = useState("");
  const [removePercent, setRemovePercent] = useState("100");

  const tokenA = tokens[tokenAIdx] || null;
  const tokenB = tokens[tokenBIdx] || null;

  const { data: pairAddress } = useReadContract({
    address: DEX_FACTORY_ADDRESS as `0x${string}`,
    abi: DEX_FACTORY_ABI,
    functionName: "getPair",
    args: tokenA && tokenB ? [tokenA.address, tokenB.address] : undefined,
    query: { enabled: !!tokenA && !!tokenB },
  });

  const hasPair = pairAddress && pairAddress !== ZERO_ADDR;

  const { data: reserves } = useReadContract({
    address: pairAddress as `0x${string}`,
    abi: DEX_PAIR_ABI,
    functionName: "getReserves",
    query: { enabled: !!hasPair },
  });

  const { data: lpBalance } = useReadContract({
    address: pairAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!hasPair },
  });

  const { data: balanceA } = useReadContract({
    address: tokenA?.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenA },
  });

  const { data: balanceB } = useReadContract({
    address: tokenB?.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenB },
  });

  const { data: allowanceA } = useReadContract({
    address: tokenA?.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && tokenA ? [address, DEX_ROUTER_ADDRESS as `0x${string}`] : undefined,
    query: { enabled: !!address && !!tokenA },
  });

  const { data: allowanceB } = useReadContract({
    address: tokenB?.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && tokenB ? [address, DEX_ROUTER_ADDRESS as `0x${string}`] : undefined,
    query: { enabled: !!address && !!tokenB },
  });

  const amountB = useMemo(() => {
    if (tab !== "add" || !amountA || !tokenA || !tokenB || !reserves) return "";
    const r0 = reserves[0] as bigint;
    if (r0 === 0n) return "";
    const parsedA = parseUnits(amountA, tokenA.decimals);
    const r1 = reserves[1] as bigint;
    return formatUnits(parsedA * r1 / r0, tokenB.decimals);
  }, [tab, amountA, tokenA, tokenB, reserves]);

  const parsedAmountA = amountA && tokenA ? parseUnits(amountA, tokenA.decimals) : 0n;
  const parsedAmountB = amountB && tokenB ? parseUnits(amountB, tokenB.decimals) : 0n;
  const needsApproveA = tokenA && allowanceA !== undefined && parsedAmountA > 0n && allowanceA < parsedAmountA;
  const needsApproveB = tokenB && allowanceB !== undefined && parsedAmountB > 0n && allowanceB < parsedAmountB;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleApproveA = () => {
    if (!tokenA) return;
    writeContract({
      address: tokenA.address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [DEX_ROUTER_ADDRESS as `0x${string}`, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
    });
  };

  const handleApproveB = () => {
    if (!tokenB) return;
    writeContract({
      address: tokenB.address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [DEX_ROUTER_ADDRESS as `0x${string}`, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
    });
  };

  const handleAddLiquidity = () => {
    if (!address || !tokenA || !tokenB) return;
    writeContract({
      address: DEX_ROUTER_ADDRESS as `0x${string}`,
      abi: DEX_ROUTER_ABI,
      functionName: "addLiquidity",
      args: [
        tokenA.address,
        tokenB.address,
        parsedAmountA,
        parsedAmountB,
        parsedAmountA * 95n / 100n,
        parsedAmountB * 95n / 100n,
        address,
        getDeadline(),
      ],
    });
  };

  const handleRemoveLiquidity = () => {
    if (!address || !tokenA || !tokenB || !lpBalance) return;
    const liquidityToRemove = lpBalance * BigInt(removePercent) / 100n;
    writeContract({
      address: DEX_ROUTER_ADDRESS as `0x${string}`,
      abi: DEX_ROUTER_ABI,
      functionName: "removeLiquidity",
      args: [
        tokenA.address,
        tokenB.address,
        liquidityToRemove,
        0n,
        0n,
        address,
        getDeadline(),
      ],
    });
  };

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("add")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "add" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
          }`}
        >
          Add Liquidity
        </button>
        <button
          onClick={() => setTab("remove")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "remove" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
          }`}
        >
          Remove Liquidity
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex gap-3">
          <TokenSelect tokens={tokens} selectedIdx={tokenAIdx} onSelect={setTokenAIdx} label="Token A" />
          <TokenSelect tokens={tokens} selectedIdx={tokenBIdx} onSelect={setTokenBIdx} label="Token B" />
        </div>

        {tab === "add" ? (
          <>
            <LiquidityInput
              label="Amount A"
              value={amountA}
              onChange={setAmountA}
              balance={balanceA && tokenA ? formatUnits(balanceA, tokenA.decimals) : undefined}
            />
            <LiquidityInput
              label="Amount B (auto)"
              value={amountB}
              readOnly
              balance={balanceB && tokenB ? formatUnits(balanceB, tokenB.decimals) : undefined}
            />
            {reserves && (reserves[0] as bigint) > 0n && (
              <div className="text-xs text-zinc-500">
                Pool: {formatUnits(reserves[0] as bigint, tokenA?.decimals || 18)} {tokenA?.symbol} / {formatUnits(reserves[1] as bigint, tokenB?.decimals || 18)} {tokenB?.symbol}
              </div>
            )}
          </>
        ) : (
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Amount to remove</span>
              <span className="text-xs text-zinc-500">
                LP Balance: {lpBalance ? formatUnits(lpBalance, 18) : "0"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={removePercent}
                onChange={(e) => setRemovePercent(e.target.value)}
                className="flex-1 bg-transparent text-xl font-medium text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="0"
                max="100"
              />
              <span className="text-zinc-400">%</span>
            </div>
            <div className="flex gap-2 mt-2">
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  onClick={() => setRemovePercent(String(p))}
                  className={`flex-1 py-1 text-xs rounded ${
                    removePercent === String(p) ? "bg-indigo-600 text-white" : "bg-zinc-700 text-zinc-400"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isSuccess && (
        <div className="mt-3 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400 text-sm text-center">
          Transaction confirmed!
        </div>
      )}

      {!address ? (
        <div className="mt-4 flex justify-center">
          <ConnectButton />
        </div>
      ) : tab === "add" ? (
        <AddLiquidityActions
          needsApproveA={!!needsApproveA}
          needsApproveB={!!needsApproveB}
          onApproveA={handleApproveA}
          onApproveB={handleApproveB}
          onAdd={handleAddLiquidity}
          isPending={isPending}
          isConfirming={isConfirming}
          hasAmounts={parsedAmountA > 0n && parsedAmountB > 0n}
          tokenASymbol={tokenA?.symbol}
          tokenBSymbol={tokenB?.symbol}
        />
      ) : (
        <button
          onClick={handleRemoveLiquidity}
          disabled={isPending || isConfirming || !lpBalance || lpBalance === 0n}
          className="w-full mt-4 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
        >
          {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Remove Liquidity"}
        </button>
      )}
    </div>
  );
}

function TokenSelect({
  tokens,
  selectedIdx,
  onSelect,
  label,
}: {
  tokens: TokenData[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  label: string;
}) {
  return (
    <div className="flex-1">
      <span className="text-xs text-zinc-500 mb-1 block">{label}</span>
      <select
        value={selectedIdx}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="w-full bg-zinc-800 text-white text-sm px-3 py-2 rounded-lg outline-none cursor-pointer"
      >
        {tokens.map((t, i) => (
          <option key={t.address} value={i}>{t.symbol}</option>
        ))}
      </select>
    </div>
  );
}

function LiquidityInput({
  label,
  value,
  onChange,
  readOnly,
  balance,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  balance?: string;
}) {
  return (
    <div className="bg-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500">{label}</span>
        {balance && <span className="text-xs text-zinc-500">Balance: {parseFloat(balance).toFixed(4)}</span>}
      </div>
      <input
        type="number"
        placeholder="0.0"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        className="w-full bg-transparent text-xl font-medium text-white outline-none placeholder-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}

function AddLiquidityActions({
  needsApproveA,
  needsApproveB,
  onApproveA,
  onApproveB,
  onAdd,
  isPending,
  isConfirming,
  hasAmounts,
  tokenASymbol,
  tokenBSymbol,
}: {
  needsApproveA: boolean;
  needsApproveB: boolean;
  onApproveA: () => void;
  onApproveB: () => void;
  onAdd: () => void;
  isPending: boolean;
  isConfirming: boolean;
  hasAmounts: boolean;
  tokenASymbol?: string;
  tokenBSymbol?: string;
}) {
  if (!hasAmounts) {
    return (
      <button disabled className="w-full mt-4 py-3 rounded-xl bg-zinc-700 text-zinc-400 font-medium">
        Enter amounts
      </button>
    );
  }

  if (needsApproveA) {
    return (
      <button onClick={onApproveA} disabled={isPending || isConfirming} className="w-full mt-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50">
        {isPending || isConfirming ? "Confirming..." : `Approve ${tokenASymbol}`}
      </button>
    );
  }

  if (needsApproveB) {
    return (
      <button onClick={onApproveB} disabled={isPending || isConfirming} className="w-full mt-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50">
        {isPending || isConfirming ? "Confirming..." : `Approve ${tokenBSymbol}`}
      </button>
    );
  }

  return (
    <button onClick={onAdd} disabled={isPending || isConfirming} className="w-full mt-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50">
      {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Add Liquidity"}
    </button>
  );
}
