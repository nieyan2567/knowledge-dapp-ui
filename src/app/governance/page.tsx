"use client";

import { useMemo, useState } from "react";
import {
  encodeFunctionData,
  keccak256,
  parseEther,
  stringToBytes,
  toHex,
} from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Navbar } from "@/components/navbar";
import { CONTRACTS, ABIS } from "@/contracts";
import { SectionCard } from "@/components/section-card";
import { PageHeader } from "@/components/page-header";

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
      args: [BigInt(minVotes || "0"), parseEther(rewardPerVote || "0")],
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
        [calldata],
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
        [calldata],
        descriptionHash,
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
        [calldata],
        descriptionHash,
      ],
      account: address,
    });
  }

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <PageHeader
          eyebrow="Governor · Timelock · DAO"
          title="DAO Governance"
          description="通过 Governor + Timelock 管理奖励规则与系统参数。当前 MVP 支持发起修改奖励规则的提案，并手动进行投票、排队和执行。"
        />

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Proposal Threshold</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {proposalThreshold ? String(proposalThreshold) : "-"}
            </div>
            <div className="mt-3 text-sm text-slate-500">发起提案所需的最小投票权</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Voting Delay</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {votingDelay ? String(votingDelay) : "-"}
            </div>
            <div className="mt-3 text-sm text-slate-500">提案创建后到投票开始前的延迟</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Voting Period</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {votingPeriod ? String(votingPeriod) : "-"}
            </div>
            <div className="mt-3 text-sm text-slate-500">提案的可投票持续时间</div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            title="Create Proposal"
            description="当前版本支持发起“修改奖励规则”的提案。提交后可在钱包交易详情或浏览器中查看 proposalId。"
          >
            <div className="space-y-4">
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                value={minVotes}
                onChange={(e) => setMinVotes(e.target.value)}
                placeholder="minVotesToReward"
              />
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                value={rewardPerVote}
                onChange={(e) => setRewardPerVote(e.target.value)}
                placeholder="rewardPerVote (ETH)"
              />
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="proposal description"
              />
              <button
                onClick={handlePropose}
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
              >
                Propose
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="Proposal Actions"
            description="输入 proposalId 后执行投票、排队与执行。建议先在 Chainlens 中确认提案状态，再操作。"
          >
            <div className="space-y-4">
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                value={proposalId}
                onChange={(e) => setProposalId(e.target.value)}
                placeholder="输入 Proposal ID"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleVote(1)}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Vote For
                </button>
                <button
                  onClick={() => handleVote(0)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Vote Against
                </button>
                <button
                  onClick={() => handleVote(2)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Abstain
                </button>
                <button
                  onClick={handleQueue}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Queue
                </button>
                <button
                  onClick={handleExecute}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Execute
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </main>
    </div>
  );
}