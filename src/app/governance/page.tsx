"use client";

import { useMemo, useState } from "react";
import { encodeFunctionData, keccak256, toHex, stringToBytes, parseEther } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Navbar } from "@/components/navbar";
import { CONTRACTS, ABIS } from "@/contracts";
import { SectionCard } from "@/components/section-card";

export default function GovernancePage() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [minVotes, setMinVotes] = useState("10");
  const [rewardPerVote, setRewardPerVote] = useState("0.001");
  const [description, setDescription] = useState("Proposal: update reward rules");
  const [proposalId, setProposalId] = useState("");

  const { data: proposalThreshold } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalThreshold",
  });

  const { data: votingDelay } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "votingDelay",
  });

  const { data: votingPeriod } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "votingPeriod",
  });

  const calldata = useMemo(() => {
    return encodeFunctionData({
      abi: ABIS.KnowledgeContent,
      functionName: "setRewardRules",
      args: [
        BigInt(minVotes || "0"),
        parseEther(rewardPerVote || "0"),
      ],
    });
  }, [minVotes, rewardPerVote]);

  const descriptionHash = useMemo(() => {
    return keccak256(toHex(stringToBytes(description)));
  }, [description]);

  async function handlePropose() {
    if (!address) return;

    await writeContractAsync({
      address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
      abi: ABIS.KnowledgeGovernor,
      functionName: "propose",
      args: [
        [CONTRACTS.KnowledgeContent as `0x${string}`],
        [0n],
        [calldata as `0x${string}`],
        description,
      ],
      account: address,
    });
  }

  async function handleVote(support: 0 | 1 | 2) {
    if (!address || !proposalId) return;

    await writeContractAsync({
      address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
      abi: ABIS.KnowledgeGovernor,
      functionName: "castVote",
      args: [BigInt(proposalId), support],
      account: address,
    });
  }

  async function handleQueue() {
    if (!address) return;

    await writeContractAsync({
      address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
      abi: ABIS.KnowledgeGovernor,
      functionName: "queue",
      args: [
        [CONTRACTS.KnowledgeContent as `0x${string}`],
        [0n],
        [calldata as `0x${string}`],
        descriptionHash as `0x${string}`,
      ],
      account: address,
    });
  }

  async function handleExecute() {
    if (!address) return;

    await writeContractAsync({
      address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
      abi: ABIS.KnowledgeGovernor,
      functionName: "execute",
      args: [
        [CONTRACTS.KnowledgeContent as `0x${string}`],
        [0n],
        [calldata as `0x${string}`],
        descriptionHash as `0x${string}`,
      ],
      account: address,
    });
  }

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">DAO Governance</h1>
          <p className="mt-2 text-slate-600">通过 Governor + Timelock 管理奖励规则与系统参数。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Proposal Threshold</div>
            <div className="mt-2 text-2xl font-semibold">{proposalThreshold ? String(proposalThreshold) : "-"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Voting Delay</div>
            <div className="mt-2 text-2xl font-semibold">{votingDelay ? String(votingDelay) : "-"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Voting Period</div>
            <div className="mt-2 text-2xl font-semibold">{votingPeriod ? String(votingPeriod) : "-"}</div>
          </div>
        </div>

        <SectionCard
          title="Create Proposal"
          description="当前 MVP 支持发起“修改奖励规则”的提案。"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <input
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              value={minVotes}
              onChange={(e) => setMinVotes(e.target.value)}
              placeholder="minVotesToReward"
            />
            <input
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              value={rewardPerVote}
              onChange={(e) => setRewardPerVote(e.target.value)}
              placeholder="rewardPerVote (ETH)"
            />
            <input
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="proposal description"
            />
          </div>
          <div className="mt-4">
            <button
              onClick={handlePropose}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Propose
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Proposal Actions"
          description="输入 proposalId 后执行投票、排队与执行。"
        >
          <div className="space-y-4">
            <input
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              value={proposalId}
              onChange={(e) => setProposalId(e.target.value)}
              placeholder="输入 Proposal ID"
            />
            <div className="flex flex-wrap gap-3">
              <button onClick={() => handleVote(1)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                Vote For
              </button>
              <button onClick={() => handleVote(0)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Vote Against
              </button>
              <button onClick={() => handleVote(2)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Abstain
              </button>
              <button onClick={handleQueue} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Queue
              </button>
              <button onClick={handleExecute} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                Execute
              </button>
            </div>
          </div>
        </SectionCard>
      </main>
    </div>
  );
}