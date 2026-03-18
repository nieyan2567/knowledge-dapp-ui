"use client";

import { Coins, ShieldCheck, Wallet } from "lucide-react";
import { formatEther } from "viem";
import { toast } from "sonner";
import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import { txToast } from "@/lib/tx-toast";
import { asBigInt } from "@/lib/web3-types";

export default function RewardsPage() {
	const { address } = useAccount();
	const { writeContractAsync } = useWriteContract();

	const [loading, setLoading] = useState(false);

	const { data: pendingRewards } = useReadContract({
		address: CONTRACTS.TreasuryNative as `0x${string}`,
		abi: ABIS.TreasuryNative,
		functionName: "pendingRewards",
		args: address ? [address] : undefined,
		query: { enabled: !!address },
	});

	const { data: epochBudget } = useReadContract({
		address: CONTRACTS.TreasuryNative as `0x${string}`,
		abi: ABIS.TreasuryNative,
		functionName: "epochBudget",
	});

	const { data: epochSpent } = useReadContract({
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

			await txToast(
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
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
			<PageHeader
				eyebrow="Treasury · Claimable Rewards"
				title="Rewards Center"
				description="Claim rewards that have already been accrued in Treasury for the connected wallet."
			/>

			{/* ================= Stats ================= */}

			<section className="grid gap-4 md:grid-cols-3">

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							Pending Rewards
						</div>
						<Wallet className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>

					<div className="text-3xl font-semibold text-slate-950 dark:text-slate-100">
						{pending} {BRANDING.nativeTokenSymbol}
					</div>

					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						Rewards currently available to claim.
					</div>
				</div>


				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							Epoch Budget
						</div>
						<Coins className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>

					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{budget} {BRANDING.nativeTokenSymbol}
					</div>

					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						Total reward budget for this epoch.
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							Epoch Spent
						</div>
						<ShieldCheck className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>

					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{spent} {BRANDING.nativeTokenSymbol}
					</div>

					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						Reward already distributed this epoch.
					</div>
				</div>

			</section>


			{/* ================= Budget Progress ================= */}

			<SectionCard
				title="Epoch Budget Usage"
				description="How much reward budget has been used in the current epoch."
			>

				<div className="space-y-4">

					<div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
						<div
							className="h-full bg-blue-500 transition-all"
							style={{ width: `${progress}%` }}
						/>
					</div>

					<div className="text-sm text-slate-500 dark:text-slate-400">
						{spent} / {budget} {BRANDING.nativeTokenSymbol} used
					</div>

				</div>

			</SectionCard>


			{/* ================= Claim ================= */}

			<SectionCard
				title="Claim Rewards"
				description="Use this action after rewards have been recorded into Treasury."
			>

				<div className="flex items-center justify-between">

					<div>
						<div className="text-sm text-slate-500 dark:text-slate-400">
							Claimable
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
						{loading ? "Claiming..." : "Claim Reward"}
					</button>

				</div>

			</SectionCard>

		</main>
	);
}