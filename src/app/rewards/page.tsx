"use client";

/**
 * 模块说明：奖励页面模块，负责待领取奖励、预算消耗、奖励历史和奖励来源列表的展示与领取流程。
 */
import Link from "next/link";
import { Coins, ExternalLink, ShieldCheck, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatEther } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { BRANDING } from "@/lib/branding";
import { reportClientError } from "@/lib/observability/client";
import {
  formatRewardBlockSummary,
  formatRewardDate,
  formatRewardTotalItems,
  getRewardHistoryFilterLabel,
  REWARD_HISTORY_FILTERS,
  REWARD_PAGE_SIZE_OPTIONS,
  REWARDS_PAGE_COPY,
} from "@/lib/rewards-page-helpers";
import {
  fetchRewardActivity,
  type RewardHistoryItem,
  type RewardSourceItem,
} from "@/lib/reward-events";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import { writeTxToast } from "@/lib/tx-toast";
import { asBigInt } from "@/lib/web3-types";

type HistoryFilter = (typeof REWARD_HISTORY_FILTERS)[number];
type LoadRewardActivityOptions = {
  background?: boolean;
};

/**
 * 上报奖励页面中的可恢复错误。
 * @param message 错误摘要信息。
 * @param error 原始错误对象或下游返回载荷。
 */
function reportRewardsPageError(message: string, error: unknown) {
  void reportClientError({
    message,
    source: "rewards.page",
    severity: "error",
    handled: true,
    error,
  });
}

/**
 * 构造奖励相关交易的区块浏览器链接。
 * @param txHash 奖励事件关联的交易哈希。
 * @returns 可跳转的浏览器链接；若哈希不存在则返回占位地址。
 */
function explorerTxUrl(txHash?: `0x${string}`) {
  if (!txHash) return "#";
  return `${BRANDING.explorerUrl}/tx/${txHash}`;
}

/**
 * 渲染奖励页面。
 * @returns 包含待领取奖励、奖励历史和领取操作的页面。
 */
export default function RewardsPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const refreshAfterTx = useRefreshOnTxConfirmed();

  const [loading, setLoading] = useState(false);
  const [loadingRewardActivity, setLoadingRewardActivity] = useState(false);
  const [rewardHistory, setRewardHistory] = useState<RewardHistoryItem[]>([]);
  const [rewardSources, setRewardSources] = useState<RewardSourceItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<
    (typeof REWARD_PAGE_SIZE_OPTIONS)[number]
  >(3);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [sourcePage, setSourcePage] = useState(1);
  const [sourcePageSize, setSourcePageSize] = useState<
    (typeof REWARD_PAGE_SIZE_OPTIONS)[number]
  >(3);

  const { data: pendingRewards, refetch: refetchPendingRewards } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "pendingRewards",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: epochBudget, refetch: refetchEpochBudget } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "epochBudget",
  });

  const { data: epochSpent, refetch: refetchEpochSpent } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "epochSpent",
  });

  const pendingValue = asBigInt(pendingRewards);
  const budgetValue = asBigInt(epochBudget);
  const spentValue = asBigInt(epochSpent);

  const pending = pendingValue ? Number(formatEther(pendingValue)) : 0;
  const budget = budgetValue ? Number(formatEther(budgetValue)) : 0;
  const spent = spentValue ? Number(formatEther(spentValue)) : 0;
  const progress = budget ? Math.min((spent / budget) * 100, 100) : 0;

  /*
   * 奖励活动列表来自事件层而不是单纯的 pendingRewards 读值，
   * 因为页面既要展示“可领多少”，也要展示“奖励是如何产生和何时被领取的”。
   */
  const loadRewardActivity = useCallback(
    async ({ background = false }: LoadRewardActivityOptions = {}) => {
    if (!publicClient || !address) {
      setRewardHistory([]);
      setRewardSources([]);
      return;
    }

    if (!background) {
      setLoadingRewardActivity(true);
    }

    try {
      const { historyItems, rewardSources } = await fetchRewardActivity(publicClient, {
        author: address,
        beneficiary: address,
      });

      setRewardHistory(historyItems);
      setRewardSources(rewardSources);
    } catch (error) {
      reportRewardsPageError("Failed to load reward activity", error);
      toast.error(REWARDS_PAGE_COPY.loadActivityFailed);
    } finally {
      if (!background) {
        setLoadingRewardActivity(false);
      }
    }
    },
    [address, publicClient]
  );

  const refreshRewardsData = useCallback(async () => {
    await Promise.all([
      refetchPendingRewards(),
      refetchEpochBudget(),
      refetchEpochSpent(),
      loadRewardActivity({ background: true }),
    ]);
  }, [loadRewardActivity, refetchEpochBudget, refetchEpochSpent, refetchPendingRewards]);

  const rewardRefreshDomains = useMemo(
    () => ["rewards", "content", "dashboard", "system"] as const,
    []
  );
  const rewardRefetchers = useMemo(() => [refreshRewardsData], [refreshRewardsData]);

  useTxEventRefetch(rewardRefreshDomains, rewardRefetchers);

  useEffect(() => {
    void loadRewardActivity();
  }, [loadRewardActivity]);

  useAutoRefresh({
    enabled: !!address,
    onRefresh: refreshRewardsData,
  });

  const filteredRewardHistory = useMemo(
    () =>
      historyFilter === "all"
        ? rewardHistory
        : rewardHistory.filter((item) => item.kind === historyFilter),
    [historyFilter, rewardHistory]
  );

  const historyTotalPages = Math.max(
    1,
    Math.ceil(filteredRewardHistory.length / historyPageSize)
  );
  const sourceTotalPages = Math.max(1, Math.ceil(rewardSources.length / sourcePageSize));

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages);
    }
  }, [historyPage, historyTotalPages]);

  useEffect(() => {
    if (sourcePage > sourceTotalPages) {
      setSourcePage(sourceTotalPages);
    }
  }, [sourcePage, sourceTotalPages]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilter]);

  const pagedRewardHistory = filteredRewardHistory.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize
  );

  const pagedRewardSources = rewardSources.slice(
    (sourcePage - 1) * sourcePageSize,
    sourcePage * sourcePageSize
  );

  async function handleClaim() {
    if (!address) {
      toast.error(REWARDS_PAGE_COPY.connectWalletFirst);
      return;
    }

    if (!pending) {
      toast.error(REWARDS_PAGE_COPY.noClaimableRewards);
      return;
    }

    try {
      setLoading(true);

      const hash = await writeTxToast({
        publicClient,
        writeContractAsync,
        request: {
          address: CONTRACTS.TreasuryNative as `0x${string}`,
          abi: ABIS.TreasuryNative,
          functionName: "claim",
          account: address,
        },
        loading: REWARDS_PAGE_COPY.claimLoading,
        success: REWARDS_PAGE_COPY.claimSuccess,
        fail: REWARDS_PAGE_COPY.claimFailed,
      });

      if (!hash) {
        return;
      }

      await refreshAfterTx(hash, refreshRewardsData, ["rewards", "dashboard", "system"]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow={REWARDS_PAGE_COPY.headerEyebrow}
        title={REWARDS_PAGE_COPY.headerTitle}
        description={REWARDS_PAGE_COPY.headerDescription}
        testId={PAGE_TEST_IDS.rewards}
      />

      <section className="grid gap-3 md:grid-cols-3">
        <div className="flex h-28 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {REWARDS_PAGE_COPY.pendingRewardsLabel}
            </div>
            <Wallet className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="text-xl font-semibold leading-none text-slate-950 dark:text-slate-100">
              {pending} {BRANDING.nativeTokenSymbol}
            </div>
            <button
              onClick={() => void handleClaim()}
              disabled={loading || !pending}
              className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {loading
                ? REWARDS_PAGE_COPY.claimButtonLoading
                : REWARDS_PAGE_COPY.claimButtonIdle}
            </button>
          </div>

          <div className="mt-auto pt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {REWARDS_PAGE_COPY.pendingRewardsHint}
          </div>
        </div>

        <div className="flex h-28 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {REWARDS_PAGE_COPY.budgetUsageLabel}
            </div>
            <Coins className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          </div>

          <div className="text-lg font-semibold leading-none text-slate-950 dark:text-slate-100">
            {progress.toFixed(1)}%
          </div>

          <div className="mt-auto space-y-1 pt-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              {REWARDS_PAGE_COPY.budgetUsageHint
                .replace("{spent}", String(spent))
                .replace("{budget}", String(budget))
                .replace("{symbol}", BRANDING.nativeTokenSymbol)}
            </div>
          </div>
        </div>

        <div className="flex h-28 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {REWARDS_PAGE_COPY.issuedInEpochLabel}
            </div>
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          </div>

          <div className="text-lg font-semibold leading-none text-slate-950 dark:text-slate-100">
            {spent} {BRANDING.nativeTokenSymbol}
          </div>

          <div className="mt-auto pt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {REWARDS_PAGE_COPY.issuedInEpochHint}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={REWARDS_PAGE_COPY.historyTitle}
          description={REWARDS_PAGE_COPY.historyDescription}
        >
          {!address ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {REWARDS_PAGE_COPY.connectWalletForHistory}
            </div>
          ) : loadingRewardActivity ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {REWARDS_PAGE_COPY.loadingHistory}
            </div>
          ) : rewardHistory.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {REWARDS_PAGE_COPY.emptyHistory}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {REWARD_HISTORY_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setHistoryFilter(filter)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      historyFilter === filter
                        ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                        : "border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {getRewardHistoryFilterLabel(filter)}
                  </button>
                ))}
              </div>

              {pagedRewardHistory.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            item.kind === "accrued"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          }`}
                        >
                          {item.kind === "accrued"
                            ? REWARDS_PAGE_COPY.badgeAccrued
                            : REWARDS_PAGE_COPY.badgeClaimed}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatRewardBlockSummary(item.blockNumber)}
                        </span>
                      </div>

                      <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.kind === "accrued"
                          ? item.contentTitle || `内容 #${item.contentId?.toString() ?? "-"}`
                          : REWARDS_PAGE_COPY.claimReceivedByCurrentWallet}
                      </div>

                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex flex-wrap items-center gap-3">
                          {item.kind === "accrued" && item.contentId !== undefined ? (
                            <Link
                              href={`/content/${item.contentId.toString()}`}
                              className="hover:text-slate-700 dark:hover:text-slate-200"
                            >
                              {REWARDS_PAGE_COPY.viewContentDetail}
                            </Link>
                          ) : null}
                          {item.txHash ? (
                            <a
                              href={explorerTxUrl(item.txHash)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
                            >
                              {REWARDS_PAGE_COPY.viewTransaction}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                          <span>{formatRewardDate(item.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                        {formatEther(item.amount)} {BRANDING.nativeTokenSymbol}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatRewardDate(item.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <PaginationControls
                page={historyPage}
                totalPages={historyTotalPages}
                pageSize={historyPageSize}
                totalItems={filteredRewardHistory.length}
                onPageChange={setHistoryPage}
                onPageSizeChange={(size) => {
                  setHistoryPageSize(size);
                  setHistoryPage(1);
                }}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={REWARDS_PAGE_COPY.rewardSourcesTitle}
          description={REWARDS_PAGE_COPY.rewardSourcesDescription}
        >
          {!address ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {REWARDS_PAGE_COPY.connectWalletForSources}
            </div>
          ) : loadingRewardActivity ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {REWARDS_PAGE_COPY.loadingSources}
            </div>
          ) : rewardSources.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {REWARDS_PAGE_COPY.emptySources}
            </div>
          ) : (
            <div className="space-y-3">
              {pagedRewardSources.map((source) => (
                <Link
                  key={source.contentId.toString()}
                  href={`/content/${source.contentId.toString()}`}
                  className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {source.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {REWARDS_PAGE_COPY.accrualCountSummary
                          .replace("{contentId}", source.contentId.toString())
                          .replace("{count}", String(source.accrualCount))}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                        {formatEther(source.totalAmount)} {BRANDING.nativeTokenSymbol}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {REWARDS_PAGE_COPY.latestBlockSummary.replace(
                          "{blockNumber}",
                          source.latestBlock.toString()
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              <PaginationControls
                page={sourcePage}
                totalPages={sourceTotalPages}
                pageSize={sourcePageSize}
                totalItems={rewardSources.length}
                onPageChange={setSourcePage}
                onPageSizeChange={(size) => {
                  setSourcePageSize(size);
                  setSourcePage(1);
                }}
              />
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}

/**
 * 渲染奖励列表的分页控制器。
 * @param page 当前页码，从 1 开始。
 * @param totalPages 总页数。
 * @param pageSize 当前每页条数。
 * @param totalItems 当前列表总条目数。
 * @param onPageChange 切换页码时触发的回调。
 * @param onPageSizeChange 切换每页条数时触发的回调。
 * @returns 可复用的奖励分页控制器。
 */
function PaginationControls({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  pageSize: (typeof REWARD_PAGE_SIZE_OPTIONS)[number];
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: (typeof REWARD_PAGE_SIZE_OPTIONS)[number]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>{REWARDS_PAGE_COPY.pageSizePrefix}</span>
        <div className="flex items-center gap-1">
          {REWARD_PAGE_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              onClick={() => onPageSizeChange(size)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                pageSize === size
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-900"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
        <span>{formatRewardTotalItems(totalItems)}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {REWARDS_PAGE_COPY.paginationPrev}
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {REWARDS_PAGE_COPY.paginationPageSummary
            .replace("{page}", String(page))
            .replace("{totalPages}", String(totalPages))}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {REWARDS_PAGE_COPY.paginationNext}
        </button>
      </div>
    </div>
  );
}
