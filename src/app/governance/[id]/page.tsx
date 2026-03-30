"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useBlockNumber,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Gavel,
  Vote as VoteIcon,
} from "lucide-react";

import { AddressBadge } from "@/components/address-badge";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { BRANDING } from "@/lib/branding";
import {
  getProposalStageCountdown,
  governanceStateBadgeClass as stateBadgeClass,
  governanceStateLabel as stateLabel,
  summarizeProposalActions,
} from "@/lib/governance";
import { reportClientError } from "@/lib/observability/client";
import { fetchProposalDetail } from "@/lib/proposal-events";
import { writeTxToast } from "@/lib/tx-toast";
import { asBigInt, asProposalVotes } from "@/lib/web3-types";
import type { ProposalItem, ProposalVotes } from "@/types/governance";

function explorerProposalUrl(txHash: string) {
  if (!txHash || txHash === "0x") return "#";
  return `${BRANDING.explorerUrl}/tx/${txHash}`;
}

function reportProposalDetailError(message: string, error: unknown) {
  void reportClientError({
    message,
    source: "governance.detail",
    severity: "error",
    handled: true,
    error,
  });
}

export default function ProposalDetailPage() {
  const params = useParams();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { writeContractAsync } = useWriteContract();
  const refreshAfterTx = useRefreshOnTxConfirmed();

  const [proposalDetail, setProposalDetail] = useState<ProposalItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  const [liveBlockNumber, setLiveBlockNumber] = useState<bigint | undefined>(
    typeof blockNumber === "bigint" ? blockNumber : undefined
  );

  const proposalId = useMemo(() => {
    const raw = typeof params?.id === "string" ? params.id : null;
    if (!raw || !/^\d+$/.test(raw)) {
      return null;
    }
    return BigInt(raw);
  }, [params]);

  const { data: state, refetch: refetchState } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "state",
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: !!proposalId },
  });

  const { data: votes, refetch: refetchVotes } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalVotes",
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: !!proposalId },
  });

  const { data: proposalEta, refetch: refetchProposalEta } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalEta",
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: !!proposalId },
  });

  const proposalState = asBigInt(state);
  const proposalEtaValue = asBigInt(proposalEta);
  const voteData: ProposalVotes =
    asProposalVotes(votes) ?? {
      againstVotes: 0n,
      forVotes: 0n,
      abstainVotes: 0n,
    };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof blockNumber === "bigint") {
      setLiveBlockNumber(blockNumber);
    }
  }, [blockNumber]);

  useEffect(() => {
    if (!publicClient) return;

    let cancelled = false;

    const updateBlockNumber = async () => {
      try {
        const latestBlock = await publicClient.getBlockNumber();
        if (!cancelled) {
          setLiveBlockNumber(latestBlock);
        }
      } catch {
        // Keep the latest known block when polling fails transiently.
      }
    };

    void updateBlockNumber();
    const timer = window.setInterval(() => {
      void updateBlockNumber();
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [publicClient]);

  const totalVotes =
    voteData.forVotes + voteData.againstVotes + voteData.abstainVotes;
  const forPercent =
    totalVotes > 0n ? Number((voteData.forVotes * 100n) / totalVotes) : 0;
  const againstPercent =
    totalVotes > 0n ? Number((voteData.againstVotes * 100n) / totalVotes) : 0;
  const abstainPercent =
    totalVotes > 0n ? Number((voteData.abstainVotes * 100n) / totalVotes) : 0;

  const canVote = Number(proposalState ?? -1) === 1;
  const canQueue = Number(proposalState ?? -1) === 4;
  const isQueued = Number(proposalState ?? -1) === 5;
  const canExecute =
    isQueued &&
    proposalEtaValue !== undefined &&
    proposalEtaValue > 0n &&
    BigInt(nowTs) >= proposalEtaValue;
  const actionSummaries = useMemo(
    () => (proposalDetail ? summarizeProposalActions(proposalDetail) : []),
    [proposalDetail]
  );
  const countdown = useMemo(
    () =>
      getProposalStageCountdown(
        liveBlockNumber,
        proposalDetail?.voteStart,
        proposalDetail?.voteEnd,
        proposalState,
        proposalEtaValue,
        BigInt(nowTs)
      ),
    [
      liveBlockNumber,
      nowTs,
      proposalDetail?.voteEnd,
      proposalDetail?.voteStart,
      proposalEtaValue,
      proposalState,
    ]
  );

  const loadProposalDetail = useCallback(async () => {
    if (!publicClient || proposalId === null) {
      setProposalDetail(null);
      return;
    }

    setLoadingDetail(true);
    try {
      const detail = await fetchProposalDetail(publicClient, proposalId);
      setProposalDetail(detail);
    } catch (error) {
      reportProposalDetailError("Failed to load proposal detail", error);
    } finally {
      setLoadingDetail(false);
    }
  }, [proposalId, publicClient]);

  useEffect(() => {
    void loadProposalDetail();
  }, [loadProposalDetail]);

  const refreshProposalDetail = useCallback(async () => {
    await Promise.all([
      refetchProposalEta(),
      refetchState(),
      refetchVotes(),
      loadProposalDetail(),
    ]);
  }, [loadProposalDetail, refetchProposalEta, refetchState, refetchVotes]);

  const governanceRefreshDomains = useMemo(
    () => ["governance", "system"] as const,
    []
  );
  const governanceRefetchers = useMemo(
    () => [refreshProposalDetail],
    [refreshProposalDetail]
  );

  useTxEventRefetch(governanceRefreshDomains, governanceRefetchers);

  useEffect(() => {
    if (liveBlockNumber === undefined || proposalId === null) {
      return;
    }

    void Promise.all([refetchProposalEta(), refetchState(), refetchVotes()]);
  }, [liveBlockNumber, proposalId, refetchProposalEta, refetchState, refetchVotes]);

  async function vote(support: 0 | 1 | 2) {
    if (!address || !proposalId) {
      toast.error("请先连接钱包");
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "castVote",
        args: [proposalId, support],
        account: address,
      },
      loading: "提交投票...",
      success: "投票成功",
      fail: "投票失败",
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshProposalDetail, ["governance", "system"]);
  }

  async function queueProposal() {
    if (!proposalDetail || !address) {
      toast.error("提案详情尚未加载，无法执行排队操作");
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "queue",
        args: [
          proposalDetail.targets,
          proposalDetail.values,
          proposalDetail.calldatas,
          proposalDetail.descriptionHash,
        ],
        account: address,
      },
      loading: "正在提交排队交易...",
      success: "排队交易已提交",
      fail: "排队失败",
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshProposalDetail, ["governance", "system"]);
  }

  async function executeProposal() {
    if (!proposalDetail || !address) {
      toast.error("提案详情尚未加载，无法执行提案");
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "execute",
        args: [
          proposalDetail.targets,
          proposalDetail.values,
          proposalDetail.calldatas,
          proposalDetail.descriptionHash,
        ],
        account: address,
      },
      loading: "正在提交执行交易...",
      success: "执行交易已提交",
      fail: "执行失败",
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshProposalDetail, ["governance", "system"]);
  }

  if (!proposalId) {
    return null;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/governance"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          返回提案列表
        </Link>

      </div>

      <PageHeader
        eyebrow={`提案 #${proposalId.toString()}`}
        title={proposalDetail?.description || "治理提案"}
        description="在这里查看提案投票结果、动作摘要，并完成后续治理操作。"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px] xl:items-start">
        <div className="space-y-6">
          <SectionCard
            title="投票分布"
            description="快速查看提案状态、总票数和各选项占比。"
          >
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Gavel className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  当前状态
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                    {countdown.label}: {countdown.value}
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${stateBadgeClass(proposalState)}`}
                  >
                    {stateLabel(proposalState)}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <InfoCard
                  compact
                  label="总票数"
                  value={totalVotes === 0n ? "0" : formatEther(totalVotes)}
                />
                <InfoCard
                  compact
                  label="赞成票"
                  value={voteData.forVotes === 0n ? "0" : formatEther(voteData.forVotes)}
                />
                <InfoCard
                  compact
                  label="反对票"
                  value={voteData.againstVotes === 0n ? "0" : formatEther(voteData.againstVotes)}
                />
                <InfoCard
                  compact
                  label="弃权票"
                  value={voteData.abstainVotes === 0n ? "0" : formatEther(voteData.abstainVotes)}
                />
              </div>

              <div className="space-y-4">
                <VoteBar
                  label="赞成"
                  value={voteData.forVotes}
                  percent={forPercent}
                  color="bg-emerald-500"
                />
                <VoteBar
                  label="反对"
                  value={voteData.againstVotes}
                  percent={againstPercent}
                  color="bg-rose-500"
                />
                <VoteBar
                  label="弃权"
                  value={voteData.abstainVotes}
                  percent={abstainPercent}
                  color="bg-slate-500"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="提案动作"
            description="保留每个动作的核心摘要，原始参数按需展开查看。"
          >
            {loadingDetail ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                正在加载动作详情...
              </div>
            ) : !proposalDetail ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                暂无动作数据。
              </div>
            ) : proposalDetail.targets.length === 0 ? (
              <div className="text-sm italic text-slate-500 dark:text-slate-400">
                该提案不包含任何链上执行动作。
              </div>
            ) : (
              <div className="space-y-4">
                {proposalDetail.targets.map((target, index) => {
                  const summary = actionSummaries[index];

                  return (
                    <div
                      key={`${target}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            动作 #{index + 1}
                          </div>
                          <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                            {summary?.title ?? "未识别动作"}
                          </div>
                        </div>
                        <div className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {summary?.functionName ?? "unknown"}
                        </div>
                      </div>

                      <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
                        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            摘要
                          </div>
                          <div className="mt-1.5">
                            {summary?.description ?? "暂无动作摘要"}
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              目标合约
                            </div>
                            <div className="mt-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/60">
                              <span className="break-all font-mono text-xs text-slate-700 dark:text-slate-300">
                                {target}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              调用值
                            </div>
                            <div className="mt-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/60">
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                                {proposalDetail.values[index]?.toString() ?? "0"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            原始 calldata
                          </div>
                          <div className="mt-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/60">
                            <span className="break-all font-mono text-xs text-slate-700 dark:text-slate-300">
                              {summary?.rawCalldata ?? proposalDetail.calldatas[index]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6">
          <SectionCard
            title="操作面板"
            description="根据提案当前状态完成投票、排队或执行。"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="rounded-lg bg-white/80 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                  {canVote
                    ? "当前提案处于投票中状态，可以参与赞成、反对或弃权投票。"
                    : canQueue
                      ? "当前提案已通过投票，可以加入 Timelock 执行队列。"
                      : canExecute
                        ? "当前提案已排队且等待期结束，可以正式执行。"
                        : "当前提案暂时没有可执行的治理操作，请关注状态变化。"}
                </div>
              </div>

              <button
                onClick={() => void vote(1)}
                disabled={!canVote}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <VoteIcon className="h-4 w-4" />
                投赞成票
              </button>

              <button
                onClick={() => void vote(0)}
                disabled={!canVote}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                投反对票
              </button>

              <button
                onClick={() => void vote(2)}
                disabled={!canVote}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                弃权
              </button>

              <div className="my-2 border-t border-slate-200 pt-2 dark:border-slate-700" />

              <button
                onClick={() => void queueProposal()}
                disabled={!canQueue || !proposalDetail}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                加入队列
              </button>

              <button
                onClick={() => void executeProposal()}
                disabled={!canExecute || !proposalDetail}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              >
                <CheckCircle2 className="h-4 w-4" />
                执行提案
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="提案信息"
            description="保留当前提案最常查看的关键信息。"
          >
            {loadingDetail ? (
              <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">
                正在加载提案详情...
              </div>
            ) : !proposalDetail ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                未找到该提案的 ProposalCreated 事件记录。
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <InfoCard compact label="提案 ID" value={proposalId.toString()} />
                  <InfoCard compact label="创建区块" value={proposalDetail.blockNumber.toString()} />
                  <InfoCard compact label="投票开始" value={proposalDetail.voteStart.toString()} />
                  <InfoCard compact label="投票结束" value={proposalDetail.voteEnd.toString()} />
                  <InfoCard compact label={countdown.label} value={countdown.value} />
                  <InfoCard compact label="动作数量" value={proposalDetail.targets.length.toString()} />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    提案人
                  </div>
                  <div className="text-sm text-slate-900 dark:text-slate-100">
                    <AddressBadge address={proposalDetail.proposer} />
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="浏览器"
            description="在区块浏览器中查看该提案交易。"
          >
            <a
              href={proposalDetail?.transactionHash ? explorerProposalUrl(proposalDetail.transactionHash) : "#"}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-2 text-sm font-medium ${
                proposalDetail?.transactionHash
                  ? "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  : "cursor-not-allowed text-slate-400"
              }`}
              onClick={(event) => {
                if (!proposalDetail?.transactionHash) {
                  event.preventDefault();
                  toast.error("尚未加载到创建提案的交易哈希");
                }
              }}
            >
              在 ChainLens 中查看
              <ExternalLink className="h-4 w-4" />
            </a>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div
        className={`text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${
          compact ? "mb-1" : "mb-2"
        }`}
      >
        {label}
      </div>
      <div
        className={`break-all font-medium text-slate-900 dark:text-slate-100 ${
          compact ? "text-[13px]" : "text-sm"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

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
  const formattedValue = value === 0n ? "0" : formatEther(value);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </div>
        <div className="font-mono text-sm text-slate-500 dark:text-slate-400">
          {formattedValue} <span className="mx-1">/</span> {percent}%
        </div>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full ${color} transition-all duration-500 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
