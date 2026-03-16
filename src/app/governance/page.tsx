"use client";

import { useMemo, useState } from "react";
import {
  encodeFunctionData,
  keccak256,
  parseEther,
  stringToBytes,
  toHex,
} from "viem";
import { toast } from "sonner";
import { useAccount, useReadContract, useWriteContract } from "wagmi";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { txToast } from "@/lib/tx-toast";

export default function GovernancePage() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [minVotes, setMinVotes] = useState("10");
  const [rewardPerVote, setRewardPerVote] = useState("0.001");
  const [description, setDescription] = useState("Proposal: update reward rules");
  const [proposalId, setProposalId] = useState("");

  function parseProposalId() {
    if (!proposalId.trim()) {
      toast.error("请输入 proposal ID");
      return null;
    }

    try {
      return BigInt(proposalId.trim());
    } catch {
      toast.error("请输入有效的 proposal ID");
      return null;
    }
  }

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

  const proposalPayload = useMemo(() => {
    try {
      return {
        calldata: encodeFunctionData({
          abi: ABIS.KnowledgeContent,
          functionName: "setRewardRules",
          args: [
            BigInt(minVotes.trim() || "0"),
            parseEther(rewardPerVote.trim() || "0"),
          ],
        }),
        descriptionHash: keccak256(toHex(stringToBytes(description.trim()))),
      };
    } catch {
      return null;
    }
  }, [description, minVotes, rewardPerVote]);

  async function handlePropose() {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    if (!description.trim()) {
      toast.error("请输入提案描述");
      return;
    }

    if (!proposalPayload) {
      toast.error("请检查提案参数格式");
      return;
    }

    await txToast(
      writeContractAsync({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "propose",
        args: [
          [CONTRACTS.KnowledgeContent as `0x${string}`],
          [0n],
          [proposalPayload.calldata],
          description.trim(),
        ],
        account: address,
      }),
      "正在提交提案...",
      "提案交易已提交",
      "提案提交失败"
    );
  }

  async function handleVote(support: 0 | 1 | 2) {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    const parsedProposalId = parseProposalId();
    if (parsedProposalId === null) return;

    await txToast(
      writeContractAsync({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "castVote",
        args: [parsedProposalId, support],
        account: address,
      }),
      "正在提交投票交易...",
      "投票交易已提交",
      "投票失败"
    );
  }

  async function handleQueue() {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    if (!proposalPayload) {
      toast.error("请检查提案参数格式");
      return;
    }

    await txToast(
      writeContractAsync({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "queue",
        args: [
          [CONTRACTS.KnowledgeContent as `0x${string}`],
          [0n],
          [proposalPayload.calldata],
          proposalPayload.descriptionHash,
        ],
        account: address,
      }),
      "正在提交排队交易...",
      "排队交易已提交",
      "排队失败"
    );
  }

  async function handleExecute() {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    if (!proposalPayload) {
      toast.error("请检查提案参数格式");
      return;
    }

    await txToast(
      writeContractAsync({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "execute",
        args: [
          [CONTRACTS.KnowledgeContent as `0x${string}`],
          [0n],
          [proposalPayload.calldata],
          proposalPayload.descriptionHash,
        ],
        account: address,
      }),
      "正在提交执行交易...",
      "执行交易已提交",
      "执行失败"
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">

      <PageHeader
        eyebrow="Governor · Timelock · DAO"
        title="DAO Governance"
        description="Create proposals, vote on them, queue them in timelock, and execute approved changes."
      />

      {/* ================= Governor Stats ================= */}

      <section className="grid gap-4 md:grid-cols-3">

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Proposal Threshold
          </div>

          <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">
            {proposalThreshold ? String(proposalThreshold) : "-"}
          </div>

          <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Minimum voting power required to create a proposal.
          </div>
        </div>


        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Voting Delay
          </div>

          <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">
            {votingDelay ? String(votingDelay) : "-"}
          </div>

          <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Delay between proposal creation and voting start.
          </div>
        </div>


        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Voting Period
          </div>

          <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">
            {votingPeriod ? String(votingPeriod) : "-"}
          </div>

          <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Duration during which proposals can be voted on.
          </div>
        </div>

      </section>

      {/* ================= Proposal Builder ================= */}

      <div className="grid gap-6 xl:grid-cols-2">

        <SectionCard
          title="Create Proposal"
          description="Build a proposal that updates reward rules in the KnowledgeContent contract."
        >
          <div className="space-y-4">

            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400"
              value={minVotes}
              onChange={(event) => setMinVotes(event.target.value)}
              placeholder="minVotesToReward"
            />

            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400"
              value={rewardPerVote}
              onChange={(event) => setRewardPerVote(event.target.value)}
              placeholder="rewardPerVote (ETH)"
            />

            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="proposal description"
            />

            <button
              onClick={handlePropose}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Propose
            </button>

          </div>
        </SectionCard>


        {/* ================= Proposal Actions ================= */}

        <SectionCard
          title="Proposal Actions"
          description="Use an existing proposal ID to vote, queue, or execute."
        >
          <div className="space-y-4">

            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400"
              value={proposalId}
              onChange={(event) => setProposalId(event.target.value)}
              placeholder="Enter Proposal ID"
            />

            <div className="flex flex-wrap gap-3">

              <button
                onClick={() => handleVote(1)}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Vote For
              </button>

              <button
                onClick={() => handleVote(0)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Vote Against
              </button>

              <button
                onClick={() => handleVote(2)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Abstain
              </button>

              <button
                onClick={handleQueue}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Queue
              </button>

              <button
                onClick={handleExecute}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Execute
              </button>

            </div>
          </div>
        </SectionCard>

      </div>

    </main>
  );
}