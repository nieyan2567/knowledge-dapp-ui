"use client";

import { BookOpen, Coins, ExternalLink, Heart } from "lucide-react";
import { toast } from "sonner";
import { useAccount, useWriteContract } from "wagmi";

import { ABIS, CONTRACTS } from "@/contracts";
import { txToast } from "@/lib/tx-toast";

const gatewayBase =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || "http://127.0.0.1:8080/ipfs";

export type ContentCardData = {
  id: bigint;
  author: `0x${string}`;
  ipfsHash: string;
  title: string;
  description: string;
  voteCount: bigint;
  timestamp: bigint;
  rewardAccrued: boolean;
};

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ContentCard({ content }: { content: ContentCardData }) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const fileUrl = `${gatewayBase}/${content.ipfsHash}`;

  async function handleVote() {
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }

    try {
      await txToast(
        writeContractAsync({
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "vote",
          args: [content.id],
          account: address,
        }),
        "Submitting vote transaction...",
        "Vote transaction submitted",
        "Vote failed"
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function handleDistributeReward() {
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }

    try {
      await txToast(
        writeContractAsync({
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "distributeReward",
          args: [content.id],
          account: address,
        }),
        "Submitting reward accrual transaction...",
        "Reward accrual transaction submitted",
        "Reward accrual failed"
      );
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <BookOpen className="h-4 w-4" />
            Content #{content.id.toString()}
          </div>

          <div className="mt-2 text-lg font-semibold text-slate-950">
            {content.title}
          </div>

          <div className="mt-1 line-clamp-2 text-sm text-slate-500">
            {content.description || "No description"}
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm text-slate-600">
        <div title={content.author}>Author: {shortenAddress(content.author)}</div>
        <div>Votes: {content.voteCount.toString()}</div>
        <div>Time: {new Date(Number(content.timestamp) * 1000).toLocaleString()}</div>
        <div>Status: {content.rewardAccrued ? "Reward accrued" : "Not accrued"}</div>

        <div className="break-all text-xs text-slate-500" title={content.ipfsHash}>
          CID: {content.ipfsHash}
        </div>

        <div className="pt-1">
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            title={content.ipfsHash}
          >
            View File
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
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
