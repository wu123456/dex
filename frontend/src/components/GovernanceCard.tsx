"use client";

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseUnits } from "viem";

const GOVERNANCE_ABI = [
  {
    inputs: [
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "description", type: "string" },
    ],
    name: "createProposal",
    outputs: [{ internalType: "uint256", name: "proposalId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "proposalId", type: "uint256" },
      { internalType: "bool", name: "support", type: "bool" },
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "proposalId", type: "uint256" }],
    name: "executeProposal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "proposalId", type: "uint256" }],
    name: "getProposal",
    outputs: [
      { internalType: "address", name: "proposer", type: "address" },
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "description", type: "string" },
      { internalType: "uint256", name: "forVotes", type: "uint256" },
      { internalType: "uint256", name: "againstVotes", type: "uint256" },
      { internalType: "uint256", name: "startTime", type: "uint256" },
      { internalType: "uint256", name: "endTime", type: "uint256" },
      { internalType: "bool", name: "executed", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "proposalId", type: "uint256" }],
    name: "getProposalState",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "proposalCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const GOVERNANCE_ADDRESS = process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || "0x0000000000000000000000000000000000000000";

export function GovernanceCard() {
  const { address } = useAccount();
  const [tab, setTab] = useState<"list" | "create">("list");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [voteProposalId, setVoteProposalId] = useState("");

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleCreate = () => {
    if (!title || !description) return;
    writeContract({
      address: GOVERNANCE_ADDRESS as `0x${string}`,
      abi: GOVERNANCE_ABI,
      functionName: "createProposal",
      args: [title, description],
    });
  };

  const handleVote = (support: boolean) => {
    if (!voteProposalId) return;
    writeContract({
      address: GOVERNANCE_ADDRESS as `0x${string}`,
      abi: GOVERNANCE_ABI,
      functionName: "vote",
      args: [BigInt(voteProposalId), support],
    });
  };

  const handleExecute = (proposalId: string) => {
    writeContract({
      address: GOVERNANCE_ADDRESS as `0x${string}`,
      abi: GOVERNANCE_ABI,
      functionName: "executeProposal",
      args: [BigInt(proposalId)],
    });
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Governance</h2>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("list")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "list" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
          }`}
        >
          Proposals
        </button>
        <button
          onClick={() => setTab("create")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "create" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
          }`}
        >
          New Proposal
        </button>
      </div>

      {tab === "create" ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Title</label>
            <input
              type="text"
              placeholder="Proposal title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-800/50 rounded-xl p-3 text-white text-sm outline-none placeholder-zinc-600"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Description</label>
            <textarea
              placeholder="Describe your proposal..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-zinc-800/50 rounded-xl p-3 text-white text-sm outline-none placeholder-zinc-600 resize-none"
            />
          </div>

          {isSuccess && (
            <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400 text-sm text-center">
              Proposal created!
            </div>
          )}

          {!address ? (
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isPending || isConfirming || !title || !description}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {isPending ? "Confirm..." : isConfirming ? "Creating..." : "Create Proposal"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Vote on Proposal</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                placeholder="Proposal ID"
                value={voteProposalId}
                onChange={(e) => setVoteProposalId(e.target.value)}
                className="flex-1 bg-zinc-700 rounded-lg p-2 text-white text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleVote(true)}
                disabled={isPending || isConfirming || !voteProposalId}
                className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-50"
              >
                For
              </button>
              <button
                onClick={() => handleVote(false)}
                disabled={isPending || isConfirming || !voteProposalId}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-50"
              >
                Against
              </button>
            </div>
          </div>

          <div className="text-center text-zinc-500 text-sm py-8">
            Connect wallet and interact with proposals on-chain
          </div>
        </div>
      )}
    </div>
  );
}
