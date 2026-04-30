"use client";

import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseUnits, formatUnits } from "viem";

const FARM_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "pid", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "pid", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "pid", type: "uint256" }],
    name: "harvest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "pid", type: "uint256" },
      { internalType: "address", name: "user", type: "address" },
    ],
    name: "pendingReward",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "poolInfo",
    outputs: [
      { internalType: "address", name: "pair", type: "address" },
      { internalType: "uint256", name: "allocPoint", type: "uint256" },
      { internalType: "uint256", name: "lastRewardBlock", type: "uint256" },
      { internalType: "uint256", name: "accRewardPerShare", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "poolLength",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "userInfo",
    outputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "rewardDebt", type: "uint256" },
      { internalType: "uint256", name: "pendingRewards", type: "uint256" },
    ],
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

const FARM_ADDRESS = process.env.NEXT_PUBLIC_FARM_ADDRESS || "0x0000000000000000000000000000000000000000";

export function FarmingCard() {
  const { address } = useAccount();
  const [poolId, setPoolId] = useState("0");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: pending } = useReadContract({
    address: FARM_ADDRESS as `0x${string}`,
    abi: FARM_ABI,
    functionName: "pendingReward",
    args: address ? [BigInt(poolId), address] : undefined,
    query: { enabled: !!address },
  });

  const { data: userInfo } = useReadContract({
    address: FARM_ADDRESS as `0x${string}`,
    abi: FARM_ABI,
    functionName: "userInfo",
    args: address ? [BigInt(poolId), address] : undefined,
    query: { enabled: !!address },
  });

  const stakedAmount = userInfo ? formatUnits(userInfo[0] as bigint, 18) : "0";

  const handleApprove = () => {
    if (!depositAmount) return;
    writeContract({
      address: FARM_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [FARM_ADDRESS as `0x${string}`, parseUnits(depositAmount, 18)],
    });
  };

  const handleDeposit = () => {
    if (!depositAmount) return;
    writeContract({
      address: FARM_ADDRESS as `0x${string}`,
      abi: FARM_ABI,
      functionName: "deposit",
      args: [BigInt(poolId), parseUnits(depositAmount, 18)],
    });
  };

  const handleWithdraw = () => {
    if (!withdrawAmount) return;
    writeContract({
      address: FARM_ADDRESS as `0x${string}`,
      abi: FARM_ABI,
      functionName: "withdraw",
      args: [BigInt(poolId), parseUnits(withdrawAmount, 18)],
    });
  };

  const handleHarvest = () => {
    writeContract({
      address: FARM_ADDRESS as `0x${string}`,
      abi: FARM_ABI,
      functionName: "harvest",
      args: [BigInt(poolId)],
    });
  };

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Liquidity Mining</h2>
      <p className="text-zinc-500 text-sm mb-6">
        Stake your LP tokens to earn reward tokens.
      </p>

      <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-xs text-zinc-500">Staked</div>
            <div className="text-lg font-medium text-white">{parseFloat(stakedAmount).toFixed(4)} LP</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Pending Rewards</div>
            <div className="text-lg font-medium text-indigo-400">
              {pending ? formatUnits(pending as bigint, 18).slice(0, 8) : "0"}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Pool ID</label>
          <input
            type="number"
            value={poolId}
            onChange={(e) => setPoolId(e.target.value)}
            className="w-full bg-zinc-800/50 rounded-xl p-3 text-white text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Deposit Amount</label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="0.0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="flex-1 bg-zinc-800/50 rounded-xl p-3 text-white text-sm outline-none placeholder-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={handleApprove} className="px-4 rounded-xl bg-zinc-700 text-white text-sm hover:bg-zinc-600">
              Approve
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Withdraw Amount</label>
          <input
            type="number"
            placeholder="0.0"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="w-full bg-zinc-800/50 rounded-xl p-3 text-white text-sm outline-none placeholder-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
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
      ) : (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button
            onClick={handleDeposit}
            disabled={isPending || isConfirming}
            className="py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            Deposit
          </button>
          <button
            onClick={handleWithdraw}
            disabled={isPending || isConfirming}
            className="py-3 rounded-xl bg-zinc-700 text-white font-medium hover:bg-zinc-600 disabled:opacity-50"
          >
            Withdraw
          </button>
          <button
            onClick={handleHarvest}
            disabled={isPending || isConfirming}
            className="py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-500 disabled:opacity-50"
          >
            Harvest
          </button>
        </div>
      )}
    </div>
  );
}
