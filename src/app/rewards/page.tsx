"use client";

import Link from "next/link";
import { Coins, ShieldCheck, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatEther, parseAbiItem } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { BRANDING } from "@/lib/branding";
import { txToast } from "@/lib/tx-toast";
import { asBigInt, asContentData } from "@/lib/web3-types";

const rewardAccrueRequestedEvent = parseAbiItem(
	"event RewardAccrueRequested(uint256 indexed contentId, address indexed author, uint256 amount)"
);

const rewardClaimedEvent = parseAbiItem(
	"event RewardClaimed(address indexed beneficiary, uint256 amount)"
);

const PAGE_SIZE_OPTIONS = [3, 5, 10] as const;

type RewardHistoryItem = {
	id: string;
	kind: "accrued" | "claimed";
	amount: bigint;
	blockNumber: bigint;
	timestamp?: bigint;
	contentId?: bigint;
	contentTitle?: string;
	txHash?: `0x${string}`;
};

type RewardSourceItem = {
	contentId: bigint;
	title: string;
	totalAmount: bigint;
	accrualCount: number;
	latestBlock: bigint;
};

function formatRewardDate(timestamp?: bigint) {
	if (timestamp === undefined) {
		return "时间未知";
	}

	return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
		hour12: false,
	});
}

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
	const [historyPageSize, setHistoryPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(3);
	const [sourcePage, setSourcePage] = useState(1);
	const [sourcePageSize, setSourcePageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(3);

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

	const loadRewardActivity = useCallback(async () => {
		if (!publicClient || !address) {
			setRewardHistory([]);
			setRewardSources([]);
			return;
		}

		setLoadingRewardActivity(true);

		try {
			const latestBlock = await publicClient.getBlockNumber();

			const [accrualLogs, claimLogs] = await Promise.all([
				publicClient.getLogs({
					address: CONTRACTS.KnowledgeContent as `0x${string}`,
					event: rewardAccrueRequestedEvent,
					args: { author: address },
					fromBlock: 0n,
					toBlock: latestBlock,
				}),
				publicClient.getLogs({
					address: CONTRACTS.TreasuryNative as `0x${string}`,
					event: rewardClaimedEvent,
					args: { beneficiary: address },
					fromBlock: 0n,
					toBlock: latestBlock,
				}),
			]);

			const contentIds = Array.from(
				new Set(
					accrualLogs
						.map((log) => log.args.contentId)
						.filter((contentId): contentId is bigint => typeof contentId === "bigint")
				)
			);

			const blockNumbers = Array.from(
				new Set(
					[...accrualLogs, ...claimLogs]
						.map((log) => log.blockNumber)
						.filter((blockNumber): blockNumber is bigint => typeof blockNumber === "bigint")
				)
			);

			const [contentEntries, blockEntries] = await Promise.all([
				Promise.all(
					contentIds.map(async (contentId) => {
						const result = await publicClient.readContract({
							address: CONTRACTS.KnowledgeContent as `0x${string}`,
							abi: ABIS.KnowledgeContent,
							functionName: "contents",
							args: [contentId],
						});

						return [contentId.toString(), asContentData(result)] as const;
					})
				),
				Promise.all(
					blockNumbers.map(async (blockNumber) => {
						const block = await publicClient.getBlock({ blockNumber });
						return [blockNumber.toString(), block.timestamp] as const;
					})
				),
			]);

			const contentMap = new Map(contentEntries);
			const blockTimestampMap = new Map(blockEntries);

			const historyItems: RewardHistoryItem[] = [
				...accrualLogs.map((log) => {
					const contentId = log.args.contentId;
					const blockNumber = log.blockNumber ?? 0n;
					const content = contentId
						? contentMap.get(contentId.toString())
						: undefined;

					return {
						id: `${log.transactionHash ?? "0x"}-accrued-${contentId?.toString() ?? "0"}`,
						kind: "accrued" as const,
						amount: log.args.amount ?? 0n,
						blockNumber,
						timestamp: blockTimestampMap.get(blockNumber.toString()),
						contentId,
						contentTitle: content?.title,
						txHash: log.transactionHash ?? undefined,
					};
				}),
				...claimLogs.map((log) => {
					const blockNumber = log.blockNumber ?? 0n;

					return {
						id: `${log.transactionHash ?? "0x"}-claimed`,
						kind: "claimed" as const,
						amount: log.args.amount ?? 0n,
						blockNumber,
						timestamp: blockTimestampMap.get(blockNumber.toString()),
						txHash: log.transactionHash ?? undefined,
					};
				}),
			].sort((left, right) => Number(right.blockNumber - left.blockNumber));

			const sourceMap = new Map<string, RewardSourceItem>();

			for (const log of accrualLogs) {
				const contentId = log.args.contentId;
				if (contentId === undefined) {
					continue;
				}

				const key = contentId.toString();
				const content = contentMap.get(key);
				const existing = sourceMap.get(key);

				if (existing) {
					existing.totalAmount += log.args.amount ?? 0n;
					existing.accrualCount += 1;
					if ((log.blockNumber ?? 0n) > existing.latestBlock) {
						existing.latestBlock = log.blockNumber ?? 0n;
					}
					continue;
				}

				sourceMap.set(key, {
					contentId,
					title: content?.title || `内容 #${contentId.toString()}`,
					totalAmount: log.args.amount ?? 0n,
					accrualCount: 1,
					latestBlock: log.blockNumber ?? 0n,
				});
			}

			setRewardHistory(historyItems);
			setRewardSources(
				Array.from(sourceMap.values()).sort((left, right) =>
					Number(right.latestBlock - left.latestBlock)
				)
			);
		} catch (error) {
			console.error(error);
			toast.error("加载奖励记录失败");
		} finally {
			setLoadingRewardActivity(false);
		}
	}, [address, publicClient]);

	const refreshRewardsData = useCallback(async () => {
		await Promise.all([
			refetchPendingRewards(),
			refetchEpochBudget(),
			refetchEpochSpent(),
			loadRewardActivity(),
		]);
	}, [loadRewardActivity, refetchEpochBudget, refetchEpochSpent, refetchPendingRewards]);

	useEffect(() => {
		void loadRewardActivity();
	}, [loadRewardActivity]);

	const historyTotalPages = Math.max(1, Math.ceil(rewardHistory.length / historyPageSize));
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

	const pagedRewardHistory = rewardHistory.slice(
		(historyPage - 1) * historyPageSize,
		historyPage * historyPageSize
	);

	const pagedRewardSources = rewardSources.slice(
		(sourcePage - 1) * sourcePageSize,
		sourcePage * sourcePageSize
	);

	async function handleClaim() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		if (!pending) {
			toast.error("暂无可领取奖励");
			return;
		}

		try {
			setLoading(true);

			const hash = await txToast(
				writeContractAsync({
					address: CONTRACTS.TreasuryNative as `0x${string}`,
					abi: ABIS.TreasuryNative,
					functionName: "claim",
					account: address,
				}),
				"正在提交领取奖励交易...",
				"领取奖励交易已提交",
				"领取奖励失败"
			);

			await refreshAfterTx(hash, refreshRewardsData, ["rewards", "dashboard", "system"]);
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
			<PageHeader
				eyebrow="Treasury · Claimable Rewards"
				title="Rewards Center"
				description="领取当前连接钱包在金库中累计的奖励。"
			/>

			<section className="grid gap-4 md:grid-cols-3">
				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">待领取奖励</div>
						<Wallet className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>

					<div className="text-3xl font-semibold text-slate-950 dark:text-slate-100">
						{pending} {BRANDING.nativeTokenSymbol}
					</div>

					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						当前可领取的奖励。
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">周期预算使用</div>
						<Coins className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>

					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{progress.toFixed(1)}%
					</div>

					<div className="mt-4 space-y-3">
						<div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
							<div
								className="h-full bg-blue-500 transition-all"
								style={{ width: `${progress}%` }}
							/>
						</div>

						<div className="text-sm text-slate-500 dark:text-slate-400">
							已使用 {spent} / {budget} {BRANDING.nativeTokenSymbol}
						</div>
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">周期已发放</div>
						<ShieldCheck className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>

					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{spent} {BRANDING.nativeTokenSymbol}
					</div>

					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						当前周期已分配的奖励。
					</div>
				</div>
			</section>

			<div className="grid gap-6 lg:grid-cols-2">
				<SectionCard
					title="历史奖励记录"
					description="查看最近的奖励记账和领取记录。"
				>
					{!address ? (
						<div className="text-sm text-slate-500 dark:text-slate-400">
							连接钱包后即可查看你的历史奖励记录。
						</div>
					) : loadingRewardActivity ? (
						<div className="text-sm text-slate-500 dark:text-slate-400">
							正在加载奖励记录...
						</div>
					) : rewardHistory.length === 0 ? (
						<div className="text-sm text-slate-500 dark:text-slate-400">
							暂无奖励历史记录。
						</div>
					) : (
						<div className="space-y-3">
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
													{item.kind === "accrued" ? "已记账" : "已领取"}
												</span>
												<span className="text-xs text-slate-500 dark:text-slate-400">
													区块 #{item.blockNumber.toString()}
												</span>
											</div>

											<div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
												{item.kind === "accrued"
													? item.contentTitle || `内容 #${item.contentId?.toString() ?? "-"}`
													: "领取到当前钱包"}
											</div>

											<div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
												{item.kind === "accrued" && item.contentId !== undefined ? (
													<Link
														href={`/content/${item.contentId.toString()}`}
														className="hover:text-slate-700 dark:hover:text-slate-200"
													>
														查看内容详情
													</Link>
												) : (
													formatRewardDate(item.timestamp)
												)}
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
								totalItems={rewardHistory.length}
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
					title="奖励来源"
					description="按内容查看奖励来自哪篇内容。"
				>
					{!address ? (
						<div className="text-sm text-slate-500 dark:text-slate-400">
							连接钱包后即可查看奖励来源。
						</div>
					) : loadingRewardActivity ? (
						<div className="text-sm text-slate-500 dark:text-slate-400">
							正在加载奖励来源...
						</div>
					) : rewardSources.length === 0 ? (
						<div className="text-sm text-slate-500 dark:text-slate-400">
							暂无内容奖励来源。
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
												内容 #{source.contentId.toString()} · 累计记账 {source.accrualCount} 次
											</div>
										</div>

										<div className="text-right">
											<div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
												{formatEther(source.totalAmount)} {BRANDING.nativeTokenSymbol}
											</div>
											<div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
												最近区块 #{source.latestBlock.toString()}
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

			<SectionCard
				title="领取奖励"
				description="在奖励记录入库后，使用此操作进行领取。"
			>
				<div className="flex items-center justify-between">
					<div>
						<div className="text-sm text-slate-500 dark:text-slate-400">可领取</div>

						<div className="text-xl font-semibold text-slate-950 dark:text-slate-100">
							{pending} {BRANDING.nativeTokenSymbol}
						</div>
					</div>

					<button
						onClick={handleClaim}
						disabled={loading || !pending}
						className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
					>
						{loading ? "领取中..." : "领取奖励"}
					</button>
				</div>
			</SectionCard>
		</main>
	);
}

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
	pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
	totalItems: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: (typeof PAGE_SIZE_OPTIONS)[number]) => void;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
			<div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
				<span>每页</span>
				<div className="flex items-center gap-1">
					{PAGE_SIZE_OPTIONS.map((size) => (
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
				<span>共 {totalItems} 条</span>
			</div>

			<div className="flex items-center gap-2">
				<button
					onClick={() => onPageChange(page - 1)}
					disabled={page <= 1}
					className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
				>
					上一页
				</button>
				<span className="text-xs text-slate-500 dark:text-slate-400">
					第 {page} / {totalPages} 页
				</span>
				<button
					onClick={() => onPageChange(page + 1)}
					disabled={page >= totalPages}
					className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
				>
					下一页
				</button>
			</div>
		</div>
	);
}
