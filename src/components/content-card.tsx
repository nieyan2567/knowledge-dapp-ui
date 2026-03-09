"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { ABIS, CONTRACTS } from "@/contracts";
import { BookOpen, Heart, Coins } from "lucide-react";

export function ContentCard({ id }: { id: number }) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const { data } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "contents",
    args: [BigInt(id)],
  });

  if (!data) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        加载中...
      </div>
    );
  }

  const content = data as readonly [
    bigint,
    `0x${string}`,
    string,
    bigint,
    bigint,
    boolean
  ];

  const [, author, ipfsHash, voteCount, timestamp, rewardAccrued] = content;

  async function handleVote() {
    if (!address) return;
    await writeContractAsync({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "vote",
      args: [BigInt(id)],
      account: address,
    });
  }

  async function handleDistributeReward() {
    if (!address) return;
    await writeContractAsync({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "distributeReward",
      args: [BigInt(id)],
      account: address,
    });
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <BookOpen className="h-4 w-4" />
            Content #{id}
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-900 break-all">
            {ipfsHash}
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm text-slate-600">
        <div className="break-all">作者：{author}</div>
        <div>票数：{voteCount.toString()}</div>
        <div>时间：{new Date(Number(timestamp) * 1000).toLocaleString()}</div>
        <div>奖励状态：{rewardAccrued ? "已记账" : "未记账"}</div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={handleVote}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Heart className="h-4 w-4" />
          Vote
        </button>

        <button
          onClick={handleDistributeReward}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Coins className="h-4 w-4" />
          Accrue Reward
        </button>
      </div>
    </div>
  );
}