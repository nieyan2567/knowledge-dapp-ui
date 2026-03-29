"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatEther } from "viem";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Coins,
  ExternalLink,
  FileText,
  Gavel,
  RefreshCw,
  UserRound,
  Vote,
  Wallet,
} from "lucide-react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { collectByBlockRange } from "@/lib/block-range";
import { BRANDING } from "@/lib/branding";
import {
  formatProposalBlockRange,
  governanceStateBadgeClass,
  governanceStateLabel,
  parseProposalCreatedLog,
  proposalCreatedEvent,
  summarizeProposalActions,
} from "@/lib/governance";
import { getIpfsFileUrl } from "@/lib/ipfs";
import { asBigInt, asContentData } from "@/lib/web3-types";
import type { ContentData } from "@/types/content";
import type { ProposalItem } from "@/types/governance";

type ContentFilter = "all" | "active" | "deleted";
type ContentSort = "updated_desc" | "votes_desc" | "version_desc";

const CONTENT_FILTER_OPTIONS: Array<{ value: ContentFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "active", label: "正常内容" },
  { value: "deleted", label: "已删除" },
];

const CONTENT_SORT_OPTIONS: Array<{ value: ContentSort; label: string }> = [
  { value: "updated_desc", label: "最近更新" },
  { value: "votes_desc", label: "票数优先" },
  { value: "version_desc", label: "版本数优先" },
];

function formatDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function shortenCid(cid: string) {
  if (cid.length <= 16) {
    return cid;
  }

  return `${cid.slice(0, 8)}...${cid.slice(-8)}`;
}

function shortenAddress(address?: string | null) {
  if (!address) return "未连接";
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTokenValue(amount: bigint) {
  return `${formatEther(amount)} ${BRANDING.nativeTokenSymbol}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return `${fallback}：${error.message}`;
  }

  return fallback;
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [loadingContents, setLoadingContents] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [myContents, setMyContents] = useState<ContentData[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [myProposals, setMyProposals] = useState<ProposalItem[]>([]);
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [contentSort, setContentSort] = useState<ContentSort>("updated_desc");

  const { data: contentCount, refetch: refetchContentCount } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "contentCount",
  });

  const { data: myVotes, refetch: refetchMyVotes } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "getVotes",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: myStaked, refetch: refetchMyStaked } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "staked",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: myPendingStake, refetch: refetchMyPendingStake } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "pendingStake",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: myPendingWithdraw, refetch: refetchMyPendingWithdraw } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "pendingWithdraw",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: myPendingRewards, refetch: refetchMyPendingRewards } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "pendingRewards",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const myVotesValue = asBigInt(myVotes) ?? 0n;
  const myStakedValue = asBigInt(myStaked) ?? 0n;
  const myPendingStakeValue = asBigInt(myPendingStake) ?? 0n;
  const myPendingWithdrawValue = asBigInt(myPendingWithdraw) ?? 0n;
  const myPendingRewardsValue = asBigInt(myPendingRewards) ?? 0n;

  const deletedContents = useMemo(
    () => myContents.filter((item) => item.deleted).length,
    [myContents]
  );

  const activeContents = useMemo(
    () => myContents.filter((item) => !item.deleted).length,
    [myContents]
  );

  const visibleContents = useMemo(() => {
    const filtered = myContents.filter((item) => {
      if (contentFilter === "active") return !item.deleted;
      if (contentFilter === "deleted") return item.deleted;
      return true;
    });

    return [...filtered].sort((left, right) => {
      switch (contentSort) {
        case "votes_desc":
          return Number(right.voteCount - left.voteCount);
        case "version_desc":
          return Number(right.latestVersion - left.latestVersion);
        case "updated_desc":
        default:
          return Number(right.lastUpdatedAt - left.lastUpdatedAt);
      }
    });
  }, [contentFilter, contentSort, myContents]);

  const loadMyContents = useCallback(
    async (countOverride?: bigint) => {
      if (!publicClient || !address) {
        setMyContents([]);
        setContentError(null);
        return;
      }

      const total = Number(countOverride ?? contentCount ?? 0n);
      if (total <= 0) {
        setMyContents([]);
        setContentError(null);
        return;
      }

      setLoadingContents(true);
      setContentError(null);

      try {
        const ids = Array.from({ length: total }, (_, index) => BigInt(index + 1));
        const results = await Promise.all(
          ids.map((id) =>
            publicClient.readContract({
              address: CONTRACTS.KnowledgeContent as `0x${string}`,
              abi: ABIS.KnowledgeContent,
              functionName: "contents",
              args: [id],
            })
          )
        );

        const authoredContents = results
          .map((item) => asContentData(item))
          .filter(
            (item): item is ContentData =>
              !!item && item.author.toLowerCase() === address.toLowerCase()
          );

        setMyContents(authoredContents);
      } catch (error) {
        setContentError(getErrorMessage(error, "加载我的内容失败"));
      } finally {
        setLoadingContents(false);
      }
    },
    [address, contentCount, publicClient]
  );

  const refreshProfile = useCallback(async () => {
    if (!address) {
      setMyContents([]);
      setMyProposals([]);
      setContentError(null);
      setProposalError(null);
      return;
    }

    try {
      const [countResult] = await Promise.all([
        refetchContentCount(),
        refetchMyVotes(),
        refetchMyStaked(),
        refetchMyPendingStake(),
        refetchMyPendingWithdraw(),
        refetchMyPendingRewards(),
      ]);

      await loadMyContents(
        typeof countResult.data === "bigint" ? countResult.data : undefined
      );
    } catch (error) {
      setContentError(getErrorMessage(error, "刷新个人内容失败"));
    }
  }, [
    address,
    loadMyContents,
    refetchContentCount,
    refetchMyPendingRewards,
    refetchMyPendingStake,
    refetchMyPendingWithdraw,
    refetchMyStaked,
    refetchMyVotes,
  ]);

  const loadMyProposals = useCallback(async () => {
    if (!publicClient || !address) {
      setMyProposals([]);
      setProposalError(null);
      return;
    }

    setLoadingProposals(true);
    setProposalError(null);

    try {
      const latestBlock = await publicClient.getBlockNumber();
      const logs = await collectByBlockRange({
        toBlock: latestBlock,
        fetchRange: ({ fromBlock, toBlock }) =>
          publicClient.getLogs({
            address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
            event: proposalCreatedEvent,
            fromBlock,
            toBlock,
          }),
      });

      const proposals = logs
        .map((log) => parseProposalCreatedLog(log))
        .filter(
          (proposal) => proposal.proposer.toLowerCase() === address.toLowerCase()
        )
        .sort((left, right) => Number(right.blockNumber - left.blockNumber));

      setMyProposals(proposals);
    } catch (error) {
      setProposalError(getErrorMessage(error, "加载我发起的提案失败"));
    } finally {
      setLoadingProposals(false);
    }
  }, [address, publicClient]);

  const refreshProfilePage = useCallback(async () => {
    await Promise.all([refreshProfile(), loadMyProposals()]);
  }, [loadMyProposals, refreshProfile]);

  useEffect(() => {
    void refreshProfilePage();
  }, [refreshProfilePage]);

  useTxEventRefetch(
    useMemo(
      () => ["content", "rewards", "stake", "dashboard", "governance", "system"] as const,
      []
    ),
    useMemo(() => [refreshProfilePage], [refreshProfilePage])
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Wallet · Content · Governance"
        title="个人中心"
        description="集中查看当前钱包的内容记录、治理参与、质押状态与待领奖励。"
        right={
          <button
            type="button"
            onClick={() => void refreshProfilePage()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            刷新数据
          </button>
        }
      />

      {!isConnected || !address ? (
        <SectionCard
          title="连接钱包后查看个人中心"
          description="个人中心需要读取当前钱包的链上状态。连接后会显示你的内容、提案、质押与奖励信息。"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
            <UserRound className="h-5 w-5 shrink-0" />
            <span>请先在右上角连接钱包。</span>
          </div>
        </SectionCard>
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <SummaryMetricCard
                icon={<UserRound className="h-4 w-4" />}
                label="当前地址"
                value={
                  <span
                    title={address}
                    className="block truncate text-sm font-medium text-slate-950 dark:text-slate-100"
                  >
                    {shortenAddress(address)}
                  </span>
                }
                description="当前连接的钱包地址"
              />
              <SummaryMetricCard
                icon={<Vote className="h-4 w-4" />}
                label="投票权"
                value={formatTokenValue(myVotesValue)}
                description="当前可用于治理投票的权重"
              />
              <SummaryMetricCard
                icon={<Coins className="h-4 w-4" />}
                label="已激活质押"
                value={formatTokenValue(myStakedValue)}
                description="已经生效并参与投票权计算"
              />
              <SummaryMetricCard
                icon={<Clock3 className="h-4 w-4" />}
                label="待激活质押"
                value={formatTokenValue(myPendingStakeValue)}
                description="已存入但尚未激活的质押"
              />
              <SummaryMetricCard
                icon={<Wallet className="h-4 w-4" />}
                label="待提取金额"
                value={formatTokenValue(myPendingWithdrawValue)}
                description="退出申请后等待提取的金额"
              />
              <SummaryMetricCard
                icon={<Coins className="h-4 w-4" />}
                label="待领奖励"
                value={formatTokenValue(myPendingRewardsValue)}
                description="当前可从 Treasury 领取的奖励"
              />
              <SummaryMetricCard
                icon={<BookOpen className="h-4 w-4" />}
                label="我的内容"
                value={String(myContents.length)}
                description={`正常 ${activeContents} 条，已删除 ${deletedContents} 条`}
              />
              <SummaryMetricCard
                icon={<Gavel className="h-4 w-4" />}
                label="我发起的提案"
                value={String(myProposals.length)}
                description="按创建区块倒序统计"
              />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="我的内容"
              description={`共 ${myContents.length} 条内容，可按状态筛选并切换排序方式。`}
              className="h-168"
              bodyClassName="flex min-h-0 flex-col"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {CONTENT_FILTER_OPTIONS.map((option) => (
                    <FilterButton
                      key={option.value}
                      active={contentFilter === option.value}
                      onClick={() => setContentFilter(option.value)}
                    >
                      {option.label}
                    </FilterButton>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="shrink-0">排序</span>
                  <select
                    value={contentSort}
                    onChange={(event) => setContentSort(event.target.value as ContentSort)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-400"
                  >
                    {CONTENT_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {contentError ? (
                <InlineErrorState
                  message={contentError}
                  retryLabel="重新加载内容"
                  onRetry={() => void refreshProfile()}
                />
              ) : null}

              {loadingContents && myContents.length === 0 ? (
                <CenteredState>正在加载你的内容...</CenteredState>
              ) : visibleContents.length === 0 ? (
                <CenteredState>
                  {myContents.length === 0
                    ? "你还没有发布过内容。"
                    : "当前筛选条件下没有匹配的内容。"}
                </CenteredState>
              ) : (
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  {visibleContents.map((item) => (
                    <article
                      key={item.id.toString()}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>内容 #{item.id.toString()}</span>
                            <span>·</span>
                            <span>v{item.latestVersion.toString()}</span>
                          </div>
                          <Link
                            href={`/content/${item.id.toString()}`}
                            className="mt-2 block truncate text-lg font-semibold text-slate-950 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300"
                          >
                            {item.title}
                          </Link>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.deleted
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          }`}
                        >
                          {item.deleted ? "已删除" : "正常"}
                        </span>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {item.description || "暂无描述"}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            最新更新时间
                          </div>
                          <div className="mt-1">{formatDate(item.lastUpdatedAt)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            当前票数
                          </div>
                          <div className="mt-1">{item.voteCount.toString()}</div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                        <div className="font-medium text-slate-700 dark:text-slate-200">
                          当前 CID
                        </div>
                        <div className="mt-1 break-all">{shortenCid(item.ipfsHash)}</div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/content/${item.id.toString()}`}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                        >
                          <FileText className="h-4 w-4" />
                          查看详情
                        </Link>
                        <a
                          href={getIpfsFileUrl(item.ipfsHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                          打开文件
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="我发起的提案"
              description={`共 ${myProposals.length} 个提案，支持固定高度滚动查看。`}
              className="h-168"
              bodyClassName="flex min-h-0 flex-col"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  最近创建的提案会优先显示在上方。
                </div>
                <button
                  type="button"
                  onClick={() => void loadMyProposals()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  重新加载
                </button>
              </div>

              {proposalError ? (
                <InlineErrorState
                  message={proposalError}
                  retryLabel="重新加载提案"
                  onRetry={() => void loadMyProposals()}
                />
              ) : null}

              {loadingProposals && myProposals.length === 0 ? (
                <CenteredState>正在加载你的提案...</CenteredState>
              ) : myProposals.length === 0 ? (
                <CenteredState>你还没有发起过提案。</CenteredState>
              ) : (
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  {myProposals.map((proposal) => (
                    <ProfileProposalCard
                      key={proposal.proposalId.toString()}
                      proposal={proposal}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </main>
  );
}

function ProfileProposalCard({ proposal }: { proposal: ProposalItem }) {
  const { data: state } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "state",
    args: [proposal.proposalId],
  });

  const proposalState = asBigInt(state);
  const actionSummaries = useMemo(
    () => summarizeProposalActions(proposal),
    [proposal]
  );

  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700 dark:hover:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>提案 #{proposal.proposalId.toString()}</span>
            <span>·</span>
            <span>创建区块 {proposal.blockNumber.toString()}</span>
          </div>
          <Link
            href={`/governance/${proposal.proposalId.toString()}`}
            className="mt-2 block truncate text-lg font-semibold text-slate-950 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300"
          >
            {proposal.description || "无描述提案"}
          </Link>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${governanceStateBadgeClass(
            proposalState
          )}`}
        >
          {governanceStateLabel(proposalState)}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
          <Gavel className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          提案动作
        </div>
        {actionSummaries.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            暂无可展示的动作摘要。
          </div>
        ) : (
          <div className="space-y-2">
            {actionSummaries.slice(0, 2).map((action, index) => (
              <div key={`${action.functionName}-${index}`}>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {action.title}
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {action.description}
                </div>
              </div>
            ))}
            {actionSummaries.length > 2 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                另外还有 {actionSummaries.length - 2} 个动作，进入详情页可查看完整内容。
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            投票区间
          </div>
          <div className="mt-1">
            {formatProposalBlockRange(proposal.voteStart, proposal.voteEnd)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            动作数量
          </div>
          <div className="mt-1">{proposal.targets.length}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/governance/${proposal.proposalId.toString()}`}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          <CheckCircle2 className="h-4 w-4" />
          查看提案
        </Link>
      </div>
    </article>
  );
}

function SummaryMetricCard({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  description: string;
}) {
  return (
    <div className="flex h-24 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
        <div className="text-slate-400 dark:text-slate-500">{icon}</div>
      </div>
      <div className="mt-2 text-lg font-semibold leading-tight text-slate-950 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-auto line-clamp-1 pt-1 text-xs text-slate-500 dark:text-slate-400">
        {description}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
          : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function InlineErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 font-medium transition hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/30"
      >
        <RefreshCw className="h-4 w-4" />
        {retryLabel}
      </button>
    </div>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
      {children}
    </div>
  );
}
