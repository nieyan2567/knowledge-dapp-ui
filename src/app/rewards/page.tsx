"use client";

import { Coins, ShieldCheck, Wallet } from "lucide-react";
import { formatEther } from "viem";
import { toast } from "sonner";
import { useCallback, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { BRANDING } from "@/lib/branding";
import { txToast } from "@/lib/tx-toast";
import { asBigInt } from "@/lib/web3-types";

export default function RewardsPage() {
	const { address } = useAccount();
	const { writeContractAsync } = useWriteContract();
	const refreshAfterTx = useRefreshOnTxConfirmed();

	const [loading, setLoading] = useState(false);

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

	const refreshRewardsData = useCallback(async () => {
		await Promise.all([
			refetchPendingRewards(),
			refetchEpochBudget(),
			refetchEpochSpent(),
		]);
	}, [refetchEpochBudget, refetchEpochSpent, refetchPendingRewards]);

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

			await refreshAfterTx(hash, refreshRewardsData);
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
			<PageHeader
				eyebrow="Treasury · Claimable Rewards"
				title="Rewards Center"
				description="领取已在金库中为当前连接钱包累积的奖励。"
			/>

			{/* ================= Stats ================= */}

			<section className="grid gap-4 md:grid-cols-3">

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							待领取奖励
						</div>
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
						<div className="text-sm text-slate-500 dark:text-slate-400">
							周期预算
						</div>
						<Coins className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>

					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{budget} {BRANDING.nativeTokenSymbol}
					</div>

					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						当前周期的奖励总预算。
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							周期已发放
						</div>
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


			{/* ================= Budget Progress ================= */}

			<SectionCard
				title="周期预算使用"
				description="当前周期已使用的奖励预算比例。"
			>

				<div className="space-y-4">

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

			</SectionCard>


			{/* ================= Claim ================= */}

			<SectionCard
				title="领取奖励"
				description="在奖励记录入库后，使用此操作进行领取。"
			>

				<div className="flex items-center justify-between">

					<div>
						<div className="text-sm text-slate-500 dark:text-slate-400">
							可领取
						</div>

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
