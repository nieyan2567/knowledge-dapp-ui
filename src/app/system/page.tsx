"use client";

import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { ABIS, CONTRACTS } from "@/contracts";
import { SectionCard } from "@/components/section-card";
import { PageHeader } from "@/components/page-header";
import { AddressBadge } from "@/components/address-badge";
import { BRANDING } from "@/lib/branding";
import { asBigInt } from "@/lib/web3-types";

function explorerAddressUrl(address: string) {
	return `${BRANDING.explorerUrl}/address/${address}`;
}

export default function SystemPage() {
	const { data: contentOwner } = useReadContract({
		address: CONTRACTS.KnowledgeContent as `0x${string}`,
		abi: ABIS.KnowledgeContent,
		functionName: "owner",
	});

	const { data: votesContract } = useReadContract({
		address: CONTRACTS.KnowledgeContent as `0x${string}`,
		abi: ABIS.KnowledgeContent,
		functionName: "votesContract",
	});

	const { data: treasury } = useReadContract({
		address: CONTRACTS.KnowledgeContent as `0x${string}`,
		abi: ABIS.KnowledgeContent,
		functionName: "treasury",
	});

	const { data: treasuryOwner } = useReadContract({
		address: CONTRACTS.TreasuryNative as `0x${string}`,
		abi: ABIS.TreasuryNative,
		functionName: "owner",
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

	const { data: minDelay } = useReadContract({
		address: CONTRACTS.TimelockController as `0x${string}`,
		abi: ABIS.TimelockController,
		functionName: "getMinDelay",
	});

	const { data: governorToken } = useReadContract({
		address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
		abi: ABIS.KnowledgeGovernor,
		functionName: "token",
	});

	const epochBudgetValue = asBigInt(epochBudget);
	const epochSpentValue = asBigInt(epochSpent);
	const minDelayValue = asBigInt(minDelay);

	return (
		<main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
			<PageHeader
				eyebrow="Contracts · Roles · Treasury"
				title="System Overview"
				description="查看链上关键合约地址、治理参数与 Treasury 状态。"
				right={
					<a
						href={BRANDING.explorerUrl}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
					>
						打开 {BRANDING.explorerName}
					</a>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-2">
				<SectionCard title="KnowledgeContent">
					<div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
						<div className="flex items-center justify-between gap-3">
							<span>合约地址</span>
							<AddressBadge address={CONTRACTS.KnowledgeContent} />
						</div>
						<div className="flex items-center justify-between gap-3">
							<span>所有者 (Owner)</span>
							<AddressBadge address={String(contentOwner ?? "")} />
						</div>
						<div className="flex items-center justify-between gap-3">
							<span>投票合约 (Votes)</span>
							<AddressBadge address={String(votesContract ?? "")} />
						</div>
						<div className="flex items-center justify-between gap-3">
							<span>金库 (Treasury)</span>
							<AddressBadge address={String(treasury ?? "")} />
						</div>

						<div className="pt-2">
							<a
								href={explorerAddressUrl(CONTRACTS.KnowledgeContent)}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								在 {BRANDING.explorerName} 中查看
							</a>
						</div>
					</div>
				</SectionCard>

				<SectionCard title="TreasuryNative">
					<div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
						<div className="flex items-center justify-between gap-3">
							<span>合约地址</span>
							<AddressBadge address={CONTRACTS.TreasuryNative} />
						</div>
						<div className="flex items-center justify-between gap-3">
							<span>所有者 (Owner)</span>
							<AddressBadge address={String(treasuryOwner ?? "")} />
						</div>
						<div className="flex items-center justify-between gap-3">
							<span>周期预算 (Epoch Budget)</span>
							<span className="font-medium text-slate-900 dark:text-slate-100">
								{epochBudgetValue ? formatEther(epochBudgetValue) : "0"}{" "}
								{BRANDING.nativeTokenSymbol}
							</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span>周期已用 (Epoch Spent)</span>
							<span className="font-medium text-slate-900 dark:text-slate-100">
								{epochSpentValue ? formatEther(epochSpentValue) : "0"}{" "}
								{BRANDING.nativeTokenSymbol}
							</span>
						</div>

						<div className="pt-2">
							<a
								href={explorerAddressUrl(CONTRACTS.TreasuryNative)}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								在 {BRANDING.explorerName} 中查看
							</a>
						</div>
					</div>
				</SectionCard>

				<SectionCard title="Governor">
					<div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
						<div className="flex items-center justify-between gap-3">
							<span>合约地址</span>
							<AddressBadge address={CONTRACTS.KnowledgeGovernor} />
						</div>
						<div className="flex items-center justify-between gap-3">
							<span>治理代币 (Token)</span>
							<AddressBadge address={String(governorToken ?? "")} />
						</div>

						<div className="pt-2">
							<a
								href={explorerAddressUrl(CONTRACTS.KnowledgeGovernor)}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								在 {BRANDING.explorerName} 中查看
							</a>
						</div>
					</div>
				</SectionCard>

				<SectionCard title="Timelock">
					<div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
						<div className="flex items-center justify-between gap-3">
							<span>合约地址</span>
							<AddressBadge address={CONTRACTS.TimelockController} />
						</div>
						<div className="flex items-center justify-between gap-3">
							<span>最小延迟 (Min Delay)</span>
							<span className="font-medium text-slate-900 dark:text-slate-100">
								{minDelayValue ? String(minDelayValue) : "-"} 秒
							</span>
						</div>

						<div className="pt-2">
							<a
								href={explorerAddressUrl(CONTRACTS.TimelockController)}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								在 {BRANDING.explorerName} 中查看
							</a>
						</div>
					</div>
				</SectionCard>
			</div>
		</main>
	);
}