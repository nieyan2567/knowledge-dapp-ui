"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { formatEther } from "viem";
import { usePublicClient } from "wagmi";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { BRANDING } from "@/lib/branding";
import {
  readContentCountFromChain,
  readContentsFromChain,
} from "@/lib/content-chain";
import {
  fetchAllIndexedContents,
} from "@/lib/indexer-api";
import { readLatestProposalWithFallback } from "@/lib/governance-chain";
import { readRewardActivityWithFallback } from "@/lib/reward-chain";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import type { ContentCardData } from "@/types/content";
import type { ProposalItem } from "@/types/governance";

const RECENT_CONTENT_SCAN = 10;
const RECENT_CONTENT_LIMIT = 4;
const RECENT_REWARD_LIMIT = 4;

type DashboardRewardItem = {
  id: string;
  kind: "accrued" | "claimed";
  amount: bigint;
  blockNumber: bigint;
  timestamp?: bigint;
  contentId?: bigint;
  contentTitle?: string;
  voteCountAtAccrual?: bigint;
  author?: `0x${string}`;
  txHash?: `0x${string}`;
};

type DashboardActivityItem = {
  id: string;
  title: string;
  href: string;
  timestamp: bigint;
  kind: "proposal" | "content";
};

function formatTokenValue(amount: bigint) {
  return `${formatEther(amount)} ${BRANDING.nativeTokenSymbol}`;
}

function shortenHash(value?: `0x${string}`) {
  if (!value) return "-";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function shortenAddress(address?: `0x${string}`) {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDateTime(timestamp?: bigint) {
  if (timestamp === undefined) {
    return "时间未知";
  }

  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    hour12: false,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(timestamp: bigint) {
  const nowMs = Date.now();
  const targetMs = Number(timestamp) * 1000;
  const diffMs = Math.max(0, nowMs - targetMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "刚刚";
  }

  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)} 分钟前`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)} 小时前`;
  }

  return `${Math.floor(diffMs / day)} 天前`;
}

export default function HomePage() {
  const publicClient = usePublicClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [recentContents, setRecentContents] = useState<ContentCardData[]>([]);
  const [recentContentsLoading, setRecentContentsLoading] = useState(false);
  const [recentContentsError, setRecentContentsError] = useState<string | null>(null);

  const [latestProposal, setLatestProposal] = useState<ProposalItem | null>(null);
  const [latestProposalTimestamp, setLatestProposalTimestamp] = useState<bigint | null>(null);
  const [latestProposalLoading, setLatestProposalLoading] = useState(false);
  const [latestProposalError, setLatestProposalError] = useState<string | null>(null);

  const [recentRewards, setRecentRewards] = useState<DashboardRewardItem[]>([]);
  const [recentRewardsLoading, setRecentRewardsLoading] = useState(false);
  const [recentRewardsError, setRecentRewardsError] = useState<string | null>(null);

  const loadRecentContents = useCallback(
    async (countOverride?: bigint) => {
      setRecentContentsLoading(true);
      setRecentContentsError(null);

      try {
        const indexedContents = await fetchAllIndexedContents();

        if (indexedContents) {
          const parsed = [...indexedContents]
            .sort((left, right) => Number(right.id - left.id))
            .slice(0, RECENT_CONTENT_LIMIT);
          setRecentContents(parsed);
          return;
        }

        if (!publicClient) {
          setRecentContents([]);
          return;
        }

        const total = Number(countOverride ?? 0n);
        if (total <= 0) {
          setRecentContents([]);
          return;
        }

        const scanCount = Math.min(total, RECENT_CONTENT_SCAN);
        const parsed = (await readContentsFromChain(publicClient, scanCount))
          .sort((left, right) => Number(right.id - left.id))
          .slice(0, RECENT_CONTENT_LIMIT);

        setRecentContents(parsed);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? `加载最新内容失败：${error.message}`
            : "加载最新内容失败";
        setRecentContentsError(message);
      } finally {
        setRecentContentsLoading(false);
      }
    },
    [publicClient]
  );

  const loadLatestProposal = useCallback(async () => {
    if (!publicClient) {
      setLatestProposal(null);
      setLatestProposalTimestamp(null);
      setLatestProposalError(null);
      return;
    }

    setLatestProposalLoading(true);
    setLatestProposalError(null);

    try {
      const newest = await readLatestProposalWithFallback(publicClient);

      setLatestProposal(newest ?? null);
      if (newest) {
        const block = await publicClient.getBlock({ blockNumber: newest.blockNumber });
        setLatestProposalTimestamp(block.timestamp);
      } else {
        setLatestProposalTimestamp(null);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? `加载最新提案失败：${error.message}`
          : "加载最新提案失败";
      setLatestProposalError(message);
    } finally {
      setLatestProposalLoading(false);
    }
  }, [publicClient]);

  const loadRecentRewards = useCallback(async () => {
    if (!publicClient) {
      setRecentRewards([]);
      setRecentRewardsError(null);
      return;
    }

    setRecentRewardsLoading(true);
    setRecentRewardsError(null);

    try {
      const { historyItems } = await readRewardActivityWithFallback(publicClient);

      const items: DashboardRewardItem[] = historyItems
        .map((item) => ({
          id: item.id,
          kind: item.kind,
          amount: item.amount,
          blockNumber: item.blockNumber,
          timestamp: item.timestamp,
          contentId: item.contentId,
          contentTitle: item.contentTitle,
          voteCountAtAccrual: item.voteCountAtAccrual,
          author: item.kind === "accrued" ? item.author : item.beneficiary,
          txHash: item.txHash,
        }))
        .sort((left, right) => Number(right.blockNumber - left.blockNumber))
        .slice(0, RECENT_REWARD_LIMIT);

      setRecentRewards(items);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? `加载奖励动态失败：${error.message}`
          : "加载奖励动态失败";
      setRecentRewardsError(message);
    } finally {
      setRecentRewardsLoading(false);
    }
  }, [publicClient]);

  const refreshDashboardData = useCallback(async () => {
    let resolvedCount: bigint | undefined;

    if (publicClient) {
      resolvedCount = await readContentCountFromChain(publicClient);
    }

    await Promise.all([
      loadRecentContents(resolvedCount),
      loadLatestProposal(),
      loadRecentRewards(),
    ]);
  }, [
    loadLatestProposal,
    loadRecentContents,
    loadRecentRewards,
    publicClient,
  ]);

  useEffect(() => {
    void refreshDashboardData();
  }, [refreshDashboardData]);

  const dashboardRefreshDomains = useMemo(
    () => ["stake", "rewards", "content", "dashboard", "governance", "system"] as const,
    []
  );

  const dashboardRefetchers = useMemo(
    () => [refreshDashboardData],
    [refreshDashboardData]
  );

  useTxEventRefetch(dashboardRefreshDomains, dashboardRefetchers);

  const latestActivityItems = useMemo<DashboardActivityItem[]>(() => {
    const items: DashboardActivityItem[] = [];

    if (latestProposal && latestProposalTimestamp !== null) {
      items.push({
        id: `proposal-${latestProposal.proposalId.toString()}`,
        title: latestProposal.description || `提案 #${latestProposal.proposalId.toString()}`,
        href: `/governance/${latestProposal.proposalId.toString()}`,
        timestamp: latestProposalTimestamp,
        kind: "proposal",
      });
    }

    for (const item of recentContents) {
      items.push({
        id: `content-${item.id.toString()}`,
        title: item.title,
        href: `/content/${item.id.toString()}`,
        timestamp: item.lastUpdatedAt,
        kind: "content",
      });
    }

    return items.sort((left, right) => Number(right.timestamp - left.timestamp));
  }, [latestProposal, latestProposalTimestamp, recentContents]);

  async function handleManualRefresh() {
    try {
      setIsRefreshing(true);
      await refreshDashboardData();
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Dashboard · Content · Governance · Rewards"
        title="Dashboard"
        description="聚合展示最近奖励变化与最新链上动作，方便从首页快速进入对应内容或提案。"
        testId={PAGE_TEST_IDS.dashboard}
        right={
          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "刷新中" : "刷新数据"}
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="最新奖励状态"
          className="lg:col-span-2"
          bodyClassName="space-y-3"
        >
          {recentRewardsError ? <PanelError message={recentRewardsError} onRetry={loadRecentRewards} /> : null}

          {recentRewardsLoading && recentRewards.length === 0 ? (
            <PanelEmpty>正在加载奖励动态...</PanelEmpty>
          ) : recentRewards.length === 0 ? (
            <PanelEmpty>当前还没有奖励动态，后续会在这里显示最新记账和领取记录。</PanelEmpty>
          ) : (
            <div className="space-y-3">
              {recentRewards.slice(0, 3).map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            item.kind === "accrued"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          }`}
                        >
                          {item.kind === "accrued" ? "奖励记账" : "奖励领取"}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTime(item.timestamp)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          区块 #{item.blockNumber.toString()}
                        </span>
                      </div>

                      <div className="mt-2 text-base font-medium text-slate-900 dark:text-slate-100">
                        {item.kind === "accrued"
                          ? item.contentTitle || `内容 #${item.contentId?.toString() ?? "-"}`
                          : `${shortenAddress(item.author)} 已领取奖励`}
                      </div>

                      {item.kind === "accrued" ? (
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                          <span>作者 {shortenAddress(item.author)}</span>
                          <span>记账时票数 {item.voteCountAtAccrual?.toString() ?? "-"}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                        {formatTokenValue(item.amount)}
                      </div>
                      {item.txHash ? (
                        <a
                          href={`${BRANDING.explorerUrl}/tx/${item.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          {shortenHash(item.txHash)}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}

              <div className="pt-2">
                <Link
                  href="/rewards"
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-100"
                >
                  查看完整奖励中心
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </SectionCard>

        <aside className="space-y-4 lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
          <SectionCard
            title="最近动作"
            className="p-5"
            bodyClassName="space-y-3"
          >
            {latestProposalError ? <PanelError message={latestProposalError} onRetry={loadLatestProposal} /> : null}
            {recentContentsError ? <PanelError message={recentContentsError} onRetry={loadRecentContents} /> : null}

            {latestProposalLoading && !latestProposal && recentContentsLoading && recentContents.length === 0 ? (
              <PanelEmpty>正在加载最近动作...</PanelEmpty>
            ) : latestActivityItems.length === 0 ? (
              <PanelEmpty>当前还没有可显示的动作。</PanelEmpty>
            ) : (
              <div className="space-y-4">
                <div className="relative pl-8">
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="space-y-5">
                    {latestActivityItems.slice(0, 6).map((item) => (
                      <div key={item.id} className="relative">
                        <span className="absolute -left-[1.58rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-300 dark:border-slate-900 dark:bg-slate-600" />
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{formatRelativeTime(item.timestamp)}</span>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              item.kind === "proposal"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                                : "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                            }`}
                          >
                            {item.kind === "proposal" ? "Proposal" : "Content"}
                          </span>
                        </div>
                        <Link
                          href={item.href}
                          className="mt-2 block text-base leading-7 text-slate-900 transition hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-300"
                          title={item.title}
                        >
                          {item.title}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pl-8">
                  <Link
                    href="/content"
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    查看更多日志
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            )}
          </SectionCard>
        </aside>
      </div>
    </main>
  );
}

function PanelError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void> | void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
      <span>{message}</span>
      <button
        type="button"
        onClick={() => void onRetry()}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 font-medium transition hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/30"
      >
        <RefreshCw className="h-4 w-4" />
        重试
      </button>
    </div>
  );
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
      {children}
    </div>
  );
}
