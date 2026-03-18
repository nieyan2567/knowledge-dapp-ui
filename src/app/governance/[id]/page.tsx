"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Gavel,
  Vote,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { AddressBadge } from "@/components/address-badge";
import { ABIS, CONTRACTS } from "@/contracts";
import { txToast } from "@/lib/tx-toast";
import { BRANDING } from "@/lib/branding";

function explorerProposalUrl(id: bigint) {
  return `${BRANDING.explorerUrl}/tx/${id.toString()}`;
}

function stateLabel(state?: bigint) {
  switch (Number(state ?? -1)) {
    case 0:
      return "Pending";
    case 1:
      return "Active";
    case 2:
      return "Canceled";
    case 3:
      return "Defeated";
    case 4:
      return "Succeeded";
    case 5:
      return "Queued";
    case 6:
      return "Expired";
    case 7:
      return "Executed";
    default:
      return "Unknown";
  }
}

export default function ProposalDetailPage() {
  const params = useParams();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const proposalId = useMemo(() => {
    if (!params?.id) return null;
    return BigInt(params.id as string);
  }, [params]);

  const { data: state } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "state",
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: !!proposalId },
  });

	const currentState = state as bigint | undefined;

  const { data: votes } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalVotes",
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: !!proposalId },
  });

  const voteData = useMemo(() => {
    if (!votes) {
      return {
        againstVotes: 0n,
        forVotes: 0n,
        abstainVotes: 0n,
      };
    }

    const [againstVotes, forVotes, abstainVotes] = votes as readonly [
      bigint,
      bigint,
      bigint
    ];

    return { againstVotes, forVotes, abstainVotes };
  }, [votes]);

  async function vote(support: 0 | 1 | 2) {
    if (!address || !proposalId) {
      toast.error("请先连接钱包");
      return;
    }

    await txToast(
      writeContractAsync({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "castVote",
        args: [proposalId, support],
        account: address,
      }),
      "提交投票...",
      "投票成功",
      "投票失败"
    );
  }

  async function queueProposal() {
    if (!proposalId || !address) return;

    toast.info("Queue 操作请在提案列表页面执行（需要原始 calldata）");
  }

  async function executeProposal() {
    if (!proposalId || !address) return;

    toast.info("Execute 操作请在提案列表页面执行");
  }

  if (!proposalId) {
    return null;
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
      <Link
        href="/governance"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        返回提案列表
      </Link>

      <PageHeader
        eyebrow={`Proposal #${proposalId.toString()}`}
        title="Governance Proposal"
        description="查看提案状态、投票情况，并参与 DAO 治理。"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Proposal Info */}
        <SectionCard
          title="Proposal Info"
          description="当前提案的基础链上信息"
        >
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Proposal ID</span>
              <span className="font-medium">{proposalId.toString()}</span>
            </div>

            <div className="flex justify-between">
              <span>Status</span>
              <span className="font-medium">{stateLabel(currentState)}</span>
            </div>

            <div className="flex justify-between">
              <span>Governor</span>
              <AddressBadge address={CONTRACTS.KnowledgeGovernor} />
            </div>

            <a
              href={explorerProposalUrl(proposalId)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-blue-600 dark:text-blue-400"
            >
              View in Chainlens
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </SectionCard>

        {/* Voting */}
        <SectionCard
          title="Voting"
          description="当前提案的投票统计"
        >
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>For</span>
              <span>{voteData.forVotes.toString()}</span>
            </div>

            <div className="flex justify-between">
              <span>Against</span>
              <span>{voteData.againstVotes.toString()}</span>
            </div>

            <div className="flex justify-between">
              <span>Abstain</span>
              <span>{voteData.abstainVotes.toString()}</span>
            </div>
          </div>
        </SectionCard>

        {/* Actions */}
        <SectionCard
          title="Actions"
          description="参与治理或执行提案"
        >
          <div className="space-y-3">
            <button
              onClick={() => vote(1)}
              className="w-full rounded-xl bg-slate-950 px-4 py-2 text-white dark:bg-white dark:text-slate-900"
            >
              Vote For
            </button>

            <button
              onClick={() => vote(0)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2"
            >
              Vote Against
            </button>

            <button
              onClick={() => vote(2)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2"
            >
              Abstain
            </button>

            <button
              onClick={queueProposal}
              className="w-full rounded-xl border border-slate-300 px-4 py-2"
            >
              Queue
            </button>

            <button
              onClick={executeProposal}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-500 px-4 py-2 text-green-600 dark:text-green-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              Execute
            </button>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}