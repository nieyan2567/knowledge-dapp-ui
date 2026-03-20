"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Gavel,
  Vote as VoteIcon,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { AddressBadge } from "@/components/address-badge";
import { ABIS, CONTRACTS } from "@/contracts";
import { txToast } from "@/lib/tx-toast";
import { BRANDING } from "@/lib/branding";
import { asBigInt, asProposalVotes } from "@/lib/web3-types";
import type { ProposalVotes } from "@/types/governance";

function explorerProposalUrl(id: bigint) {
  return `${BRANDING.explorerUrl}/tx/${id.toString()}`;
}

// --- [新增] 状态标签文本 ---
function stateLabel(state?: bigint) {
  switch (Number(state ?? -1)) {
    case 0: return "Pending";
    case 1: return "Active";
    case 2: return "Canceled";
    case 3: return "Defeated";
    case 4: return "Succeeded";
    case 5: return "Queued";
    case 6: return "Expired";
    case 7: return "Executed";
    default: return "Unknown";
  }
}

// --- [新增] 状态徽章样式类 ---
function stateBadgeClass(state?: bigint) {
  switch (Number(state ?? -1)) {
    case 0: return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
    case 1: return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
    case 4: return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    case 5: return "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300";
    case 7: return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
    case 2:
    case 3:
    case 6: return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
    default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

export default function ProposalDetailPage() {
  const params = useParams();
  const { address } = useAccount();
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

  const { data: votes } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalVotes",
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: !!proposalId },
  });

  const proposalState = asBigInt(state);

  const voteData: ProposalVotes =
    asProposalVotes(votes) ?? {
      againstVotes: 0n,
      forVotes: 0n,
      abstainVotes: 0n,
    };

  // --- [新增] 计算总票数和百分比 ---
  const totalVotes =
    voteData.forVotes + voteData.againstVotes + voteData.abstainVotes;

  const forPercent =
    totalVotes > 0n ? Number((voteData.forVotes * 100n) / totalVotes) : 0;
  const againstPercent =
    totalVotes > 0n ? Number((voteData.againstVotes * 100n) / totalVotes) : 0;
  const abstainPercent =
    totalVotes > 0n ? Number((voteData.abstainVotes * 100n) / totalVotes) : 0;

  // --- [新增] 核心权限判断逻辑 ---
  const canVote = Number(proposalState ?? -1) === 1;
  const canQueue = Number(proposalState ?? -1) === 4;
  const canExecute = Number(proposalState ?? -1) === 5;

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
    if (!address || !proposalId) {
      toast.error("请先连接钱包");
      return;
    }
    // 注意：实际 Queue 通常需要 targets, values, calldatas，这些在详情页可能拿不到
    // 这里暂时保留提示，或者你需要从事件日志中获取这些数据
    toast.info("Queue 操作通常在提案列表页执行（需要原始 calldata），或需补充数据源。");
  }

  async function executeProposal() {
    if (!address || !proposalId) {
      toast.error("请先连接钱包");
      return;
    }
     // 注意：实际 Execute 同样需要原始参数
    toast.info("Execute 操作通常在提案列表页执行，或需补充数据源。");
  }

  if (!proposalId) return null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
      {/* 返回导航 */}
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
        description="查看提案状态、投票分布，并参与 DAO 治理。"
      />

      {/* --- [修改] 布局优化：左右结构 (左侧信息+图表，右侧操作) --- */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        
        {/* 左侧：详细信息与投票图表 */}
        <div className="space-y-6">
          <SectionCard
            title="Proposal Info"
            description="当前提案的核心链上信息。"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Proposal ID
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {proposalId.toString()}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </div>
                {/* --- [新增] 带颜色的状态徽章 --- */}
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${stateBadgeClass(
                    proposalState
                  )}`}
                >
                  {stateLabel(proposalState)}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 md:col-span-2">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Governor Contract
                </div>
                <AddressBadge address={CONTRACTS.KnowledgeGovernor} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Voting Distribution"
            description="For / Against / Abstain 的当前投票分布。"
          >
            <div className="space-y-4">
              {/* --- [新增] 使用带进度条的 VoteBar 组件 --- */}
              <VoteBar
                label="For"
                value={voteData.forVotes}
                percent={forPercent}
                color="bg-emerald-500"
              />
              <VoteBar
                label="Against"
                value={voteData.againstVotes}
                percent={againstPercent}
                color="bg-rose-500"
              />
              <VoteBar
                label="Abstain"
                value={voteData.abstainVotes}
                percent={abstainPercent}
                color="bg-slate-500"
              />
            </div>
          </SectionCard>
        </div>

        {/* 右侧：操作面板 */}
        <div className="space-y-6">
          <SectionCard
            title="Actions"
            description="根据提案状态参与投票或执行治理动作。"
          >
            <div className="space-y-3">
              {/* --- [修复] 添加 disabled 逻辑和图标 --- */}
              <button
                onClick={() => vote(1)}
                disabled={!canVote}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <VoteIcon className="h-4 w-4" />
                Vote For
              </button>

              <button
                onClick={() => vote(0)}
                disabled={!canVote}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Vote Against
              </button>

              <button
                onClick={() => vote(2)}
                disabled={!canVote}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Abstain
              </button>

              <button
                onClick={queueProposal}
                disabled={!canQueue}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Queue
              </button>

              <button
                onClick={executeProposal}
                disabled={!canExecute}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              >
                <CheckCircle2 className="h-4 w-4" />
                Execute
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="Explorer"
            description="在 Chainlens 中查看相关链上记录。"
          >
            <a
              href={explorerProposalUrl(proposalId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View in Chainlens
              <ExternalLink className="h-4 w-4" />
            </a>
          </SectionCard>

          {/* --- [新增] 状态摘要提示 --- */}
          <SectionCard
            title="Summary"
            description="提案状态的简要说明。"
          >
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span>Current State: <strong>{stateLabel(proposalState)}</strong></span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                {canVote && "✅ 当前提案处于 Active 状态，您可以进行投票。"}
                {canQueue && "✅ 当前提案已通过投票，可以进行 Queue 操作。"}
                {canExecute && "✅ 当前提案已 Queue，可以进行 Execute 操作。"}
                {!canVote && !canQueue && !canExecute && "⚠️ 当前提案暂时不可操作，请等待状态变更。"}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}

// --- [新增] 带进度条的投票统计组件 ---
function VoteBar({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: bigint;
  percent: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {value.toString()} <span className="mx-1">·</span> {percent}%
        </div>
      </div>

      {/* 进度条背景 */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        {/* 进度条前景 */}
        <div
          className={`h-full ${color} transition-all duration-500 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}