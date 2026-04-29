"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { DEX_ROUTER_ABI, DEX_ROUTER_ADDRESS, ERC20_ABI } from "@/lib/contracts";
import { getTokensForChain } from "@/lib/tokens";

interface TokenData {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
}

function getDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 1200);
}

export function SwapCard() {
  const { address, chainId } = useAccount();
  const tokens = getTokensForChain(chainId || 31337);

  const [tokenInIdx, setTokenInIdx] = useState(0);
  const [tokenOutIdx, setTokenOutIdx] = useState(tokens.length > 1 ? 1 : 0);
  const [amountIn, setAmountIn] = useState("");
  const [slippage, setSlippage] = useState("0.5");

  const tokenIn = tokens[tokenInIdx] || null;
  const tokenOut = tokens[tokenOutIdx] || null;

  const path = tokenIn && tokenOut ? [tokenIn.address, tokenOut.address] as `0x${string}`[] : undefined;
  const parsedAmountIn = amountIn && tokenIn ? parseUnits(amountIn, tokenIn.decimals) : 0n;

  const { data: amountsOut } = useReadContract({
    address: DEX_ROUTER_ADDRESS as `0x${string}`,
    abi: DEX_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: path && parsedAmountIn > 0n ? [parsedAmountIn, path] : undefined,
    query: { enabled: parsedAmountIn > 0n && !!path },
  });

  const { data: allowance } = useReadContract({
    address: tokenIn?.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && tokenIn ? [address, DEX_ROUTER_ADDRESS as `0x${string}`] : undefined,
    query: { enabled: !!address && !!tokenIn },
  });

  const { data: balance } = useReadContract({
    address: tokenIn?.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenIn },
  });

  const amountOut = amountsOut && Array.isArray(amountsOut) && amountsOut.length > 1 && tokenOut
    ? formatUnits(amountsOut[1] as bigint, tokenOut.decimals)
    : "";

  const needsApproval = tokenIn && allowance !== undefined && parsedAmountIn > 0n && allowance < parsedAmountIn;

  const slippageBps = BigInt(Math.floor(parseFloat(slippage) * 100));
  const parsedAmountOut = amountOut && tokenOut ? parseUnits(amountOut, tokenOut.decimals) : 0n;
  const amountOutMin = parsedAmountOut > 0n ? parsedAmountOut * (10000n - slippageBps) / 10000n : 0n;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleApprove = () => {
    if (!tokenIn) return;
    writeContract({
      address: tokenIn.address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [DEX_ROUTER_ADDRESS as `0x${string}`, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
    });
  };

  const handleSwap = () => {
    if (!address || !path || parsedAmountIn <= 0n) return;
    writeContract({
      address: DEX_ROUTER_ADDRESS as `0x${string}`,
      abi: DEX_ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [parsedAmountIn, amountOutMin, path, address, getDeadline()],
    });
  };

  const switchTokens = () => {
    const tmpIdx = tokenInIdx;
    setTokenInIdx(tokenOutIdx);
    setTokenOutIdx(tmpIdx);
    setAmountIn(amountOut);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Swap</h2>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Slippage:</span>
          <input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            className="w-14 px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-center text-white"
            step="0.1"
            min="0.1"
            max="50"
          />
          <span>%</span>
        </div>
      </div>

      <div className="space-y-2">
        <TokenInput
          label="From"
          token={tokenIn}
          amount={amountIn}
          onAmountChange={setAmountIn}
          balance={balance && tokenIn ? formatUnits(balance, tokenIn.decimals) : undefined}
        />

        <div className="flex justify-center -my-1">
          <button
            onClick={switchTokens}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            ↓
          </button>
        </div>

        <TokenInput
          label="To"
          token={tokenOut}
          amount={amountOut}
          readOnly
        />
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
      ) : !tokenIn || !path || !amountIn || parsedAmountIn <= 0n ? (
        <button disabled className="w-full mt-4 py-3 rounded-xl bg-zinc-700 text-zinc-400 font-medium">
          Enter an amount
        </button>
      ) : needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={isPending || isConfirming}
          className="w-full mt-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
        >
          {isPending || isConfirming ? "Confirming..." : `Approve ${tokenIn.symbol}`}
        </button>
      ) : (
        <button
          onClick={handleSwap}
          disabled={isPending || isConfirming}
          className="w-full mt-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
        >
          {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Swap"}
        </button>
      )}
    </div>
  );
}

function TokenInput({
  label,
  token,
  amount,
  onAmountChange,
  readOnly,
  balance,
}: {
  label: string;
  token: TokenData | null;
  amount: string;
  onAmountChange?: (v: string) => void;
  readOnly?: boolean;
  balance?: string;
}) {
  return (
    <div className="bg-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500">{label}</span>
        {balance && <span className="text-xs text-zinc-500">Balance: {parseFloat(balance).toFixed(4)}</span>}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          placeholder="0.0"
          value={amount}
          onChange={onAmountChange ? (e) => onAmountChange(e.target.value) : undefined}
          readOnly={readOnly}
          className="flex-1 bg-transparent text-xl font-medium text-white outline-none placeholder-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="bg-indigo-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
          {token?.symbol || "Select"}
        </span>
      </div>
    </div>
  );
}
