"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, formatEther, parseEther } from "viem";
import {
	useAccount,
	usePublicClient,
	useReadContract,
	useWriteContract,
} from "wagmi";
import { toast } from "sonner";
import {
	CheckCircle2,
	Clock3,
	ExternalLink,
	Gavel,
	RefreshCw,
	Vote,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import {
	formatProposalBlockRange,
	governanceStateBadgeClass as stateBadgeClass,
	governanceStateLabel as stateLabel,
	parseProposalCreatedLog,
	proposalCreatedEvent,
} from "@/lib/governance";
import { BRANDING } from "@/lib/branding";
import { txToast } from "@/lib/tx-toast";
import { asBigInt, asProposalVotes } from "@/lib/web3-types";
import type { ProposalItem, ProposalVotes } from "@/types/governance";

function shortenAddress(address: string) {
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function explorerAddressUrl(address: string) {
	return `${BRANDING.explorerUrl}/address/${address}`;
}

function formatBlockRange(start?: bigint, end?: bigint) {
	return formatProposalBlockRange(start, end);
}

export default function GovernancePage() {
	const { address } = useAccount();
	const publicClient = usePublicClient();
	const { writeContractAsync } = useWriteContract();
	const refreshAfterTx = useRefreshOnTxConfirmed();

	const [minVotes, setMinVotes] = useState("10");
	const [rewardPerVote, setRewardPerVote] = useState("0.001");
	const [description, setDescription] = useState("提案：更新奖励规则");
	const [loadingProposals, setLoadingProposals] = useState(false);
	const [proposals, setProposals] = useState<ProposalItem[]>([]);

	const { data: proposalThreshold } = useReadContract({
		address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
		abi: ABIS.KnowledgeGovernor,
		functionName: "proposalThreshold",
	});

	const { data: votingDelay } = useReadContract({
		address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
		abi: ABIS.KnowledgeGovernor,
		functionName: "votingDelay",
	});

	const { data: votingPeriod } = useReadContract({
		address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
		abi: ABIS.KnowledgeGovernor,
		functionName: "votingPeriod",
	});

	const proposalCalldata = useMemo(() => {
		return encodeFunctionData({
			abi: ABIS.KnowledgeContent,
			functionName: "setRewardRules",
			args: [BigInt(minVotes || "0"), parseEther(rewardPerVote || "0")],
		});
	}, [minVotes, rewardPerVote]);

	const loadProposals = useCallback(async () => {
		if (!publicClient) return;

		setLoadingProposals(true);
		try {
			const latestBlock = await publicClient.getBlockNumber();

			const logs = await publicClient.getLogs({
				address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
				event: proposalCreatedEvent,
				fromBlock: 0n,
				toBlock: latestBlock,
			});

			const parsed = logs.map((log) => parseProposalCreatedLog(log)).reverse();
			setProposals(parsed);
		} catch (error) {
			console.error(error);
			toast.error("加载提案列表失败");
		} finally {
			setLoadingProposals(false);
		}
	}, [publicClient]);

	useEffect(() => {
		void loadProposals();
	}, [loadProposals]);

	async function handlePropose() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		const hash = await txToast(
			writeContractAsync({
				address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
				abi: ABIS.KnowledgeGovernor,
				functionName: "propose",
				args: [
					[CONTRACTS.KnowledgeContent as `0x${string}`],
					[0n],
					[proposalCalldata],
					description,
				],
				account: address,
			}),
			"正在提交提案...",
			"提案交易已提交",
			"提案提交失败"
		);

		await refreshAfterTx(hash, loadProposals, ["governance", "system"]);
	}

	return (
		<main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
			<PageHeader
				eyebrow="Governor · Timelock · DAO"
				title="Governance Center"
				description="在此创建提案、浏览提案状态、进行投票以及执行治理操作。"
				right={
					<div className="flex items-center gap-3">
						<button
							onClick={loadProposals}
							className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
						>
							<RefreshCw className="h-4 w-4" />
							刷新
						</button>

						<a
							href={explorerAddressUrl(CONTRACTS.KnowledgeGovernor)}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
						>
							查看合约
							<ExternalLink className="h-4 w-4" />
						</a>
					</div>
				}
			/>

			<section className="grid gap-4 md:grid-cols-3">
				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							提案门槛
						</div>
						<Gavel className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{proposalThreshold
							? `${formatEther(proposalThreshold as bigint)} ${BRANDING.nativeTokenSymbol}`
							: "-"}
					</div>
					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						创建提案所需的最低投票权。
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							投票延迟
						</div>
						<Clock3 className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{votingDelay ? String(votingDelay) : "-"}
					</div>
					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						提案创建后到投票开始前的延迟时间（区块数）。
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							投票周期
						</div>
						<Vote className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{votingPeriod ? String(votingPeriod) : "-"}
					</div>
					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						活跃投票窗口的持续时间（区块数）。
					</div>
				</div>
			</section>

			<div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
				<div className="lg:order-2">
					<SectionCard
						title="创建提案"
						description="当前 MVP 版本支持针对 KnowledgeContent 合约提出奖励规则更新的提案。"
					>
						<div className="space-y-4">
							<input
								className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
								value={minVotes}
								onChange={(event) => setMinVotes(event.target.value)}
								placeholder="最小获奖票数 (minVotesToReward)"
							/>

							<input
								className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
								value={rewardPerVote}
								onChange={(event) => setRewardPerVote(event.target.value)}
								placeholder="单票奖励 (KC)"
							/>

							<textarea
								className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
								rows={4}
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								placeholder="提案描述"
							/>

							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
								本提案将调用：
								<div className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
									setRewardRules({minVotes}, {rewardPerVote})
								</div>
							</div>

							<button
								onClick={handlePropose}
								className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
							>
								创建提案
							</button>
						</div>
					</SectionCard>
				</div>

				<div className="space-y-4 lg:order-1 lg:col-span-2">
					<div className="flex items-center justify-between gap-4">
						<h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
							提案列表
						</h2>
						<div className="text-sm text-slate-500 dark:text-slate-400">
							共 {proposals.length} 条
						</div>
					</div>
					<ProposalList
						proposals={proposals}
						loading={loadingProposals}
						onActionComplete={loadProposals}
					/>
				</div>
			</div>
		</main>
	);
}

function ProposalList({
	proposals,
	loading,
	onActionComplete,
}: {
	proposals: ProposalItem[];
	loading: boolean;
	onActionComplete: () => unknown | Promise<unknown>;
}) {
	if (loading) {
		return (
			<div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
				正在加载提案列表...
			</div>
		);
	}

	if (proposals.length === 0) {
		return (
			<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
				暂无提案，请先创建第一条治理提案。
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{proposals.map((proposal) => (
				<ProposalCard
					key={proposal.proposalId.toString()}
					proposal={proposal}
					onActionComplete={onActionComplete}
				/>
			))}
		</div>
	);
}

function ProposalCard({
	proposal,
	onActionComplete,
}: {
	proposal: ProposalItem;
	onActionComplete: () => unknown | Promise<unknown>;
}) {
	const { address } = useAccount();
	const { writeContractAsync } = useWriteContract();
	const refreshAfterTx = useRefreshOnTxConfirmed();

	const { data: state, refetch: refetchState } = useReadContract({
		address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
		abi: ABIS.KnowledgeGovernor,
		functionName: "state",
		args: [proposal.proposalId],
	});

	const { data: votes, refetch: refetchVotes } = useReadContract({
		address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
		abi: ABIS.KnowledgeGovernor,
		functionName: "proposalVotes",
		args: [proposal.proposalId],
	});

	const proposalState = asBigInt(state);
	const currentStateLabel = stateLabel(proposalState);

	const voteData: ProposalVotes =
		asProposalVotes(votes) ?? {
			againstVotes: 0n,
			forVotes: 0n,
			abstainVotes: 0n,
		};

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
	const canExecute = Number(proposalState ?? -1) === 5;

	async function refreshProposalCard() {
		await Promise.all([refetchState(), refetchVotes(), onActionComplete()]);
	}

	async function handleVote(support: 0 | 1 | 2) {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		let actionText = "赞成";
		if (support === 0) actionText = "反对";
		if (support === 2) actionText = "弃权";

		const hash = await txToast(
			writeContractAsync({
				address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
				abi: ABIS.KnowledgeGovernor,
				functionName: "castVote",
				args: [proposal.proposalId, support],
				account: address,
			}),
			`正在提交${actionText}投票...`,
			"投票交易已提交",
			"投票失败"
		);

		await refreshAfterTx(hash, refreshProposalCard, ["governance", "system"]);
	}

	async function handleQueue() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		const hash = await txToast(
			writeContractAsync({
				address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
				abi: ABIS.KnowledgeGovernor,
				functionName: "queue",
				args: [
					proposal.targets,
					proposal.values,
					proposal.calldatas,
					proposal.descriptionHash,
				],
				account: address,
			}),
			"正在提交排队交易...",
			"排队交易已提交",
			"排队失败"
		);

		await refreshAfterTx(hash, refreshProposalCard, ["governance", "system"]);
	}

	async function handleExecute() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		const hash = await txToast(
			writeContractAsync({
				address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
				abi: ABIS.KnowledgeGovernor,
				functionName: "execute",
				args: [
					proposal.targets,
					proposal.values,
					proposal.calldatas,
					proposal.descriptionHash,
				],
				account: address,
			}),
			"正在提交执行交易...",
			"执行交易已提交",
			"执行失败"
		);

		await refreshAfterTx(hash, refreshProposalCard, ["governance", "system"]);
	}

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
			<div className="space-y-4">
				<div className="min-w-0">
					<div className="mb-1.5 flex flex-wrap items-center gap-2">
						<span className="text-xs font-medium text-slate-500 dark:text-slate-400">
							提案 #{proposal.proposalId.toString()}
						</span>
						<span
							className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${stateBadgeClass(
								proposalState
							)}`}
						>
							{currentStateLabel}
						</span>
					</div>

					<Link
						href={`/governance/${proposal.proposalId.toString()}`}
						className="text-base font-semibold text-slate-950 dark:text-slate-100"
					>
						{proposal.description || "无描述"}
					</Link>

					<div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
						<span>发起人：{shortenAddress(proposal.proposer)}</span>
						<span>创建区块：{proposal.blockNumber.toString()}</span>
						<span>
							投票区间：{formatBlockRange(proposal.voteStart, proposal.voteEnd)}
						</span>
					</div>

					<div className="mt-3 space-y-2">
						<VoteStat
							label="赞成"
							value={voteData.forVotes}
							percent={forPercent}
							color="bg-emerald-500"
						/>
						<VoteStat
							label="反对"
							value={voteData.againstVotes}
							percent={againstPercent}
							color="bg-rose-500"
						/>
						<VoteStat
							label="弃权"
							value={voteData.abstainVotes}
							percent={abstainPercent}
							color="bg-slate-500"
						/>
					</div>
				</div>

				<div className="grid gap-2 border-t border-slate-200 pt-3 dark:border-slate-800 sm:grid-cols-2 xl:grid-cols-5">
					<button
						onClick={() => handleVote(1)}
						disabled={!canVote}
						className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
					>
						投赞成票
					</button>

					<button
						onClick={() => handleVote(0)}
						disabled={!canVote}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
					>
						投反对票
					</button>

					<button
						onClick={() => handleVote(2)}
						disabled={!canVote}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
					>
						弃权
					</button>

					<button
						onClick={handleQueue}
						disabled={!canQueue}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
					>
						加入队列
					</button>

					<button
						onClick={handleExecute}
						disabled={!canExecute}
						className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
					>
						<CheckCircle2 className="h-4 w-4" />
						执行
					</button>
				</div>
			</div>
		</div>
	);
}

function VoteStat({
	label,
	value,
	percent,
	color,
}: {
	label: string;
	value: bigint;
	percent?: number;
	color?: string;
}) {
	const formattedValue = value === 0n ? "0" : formatEther(value);

	return (
		<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
			<div className="mb-1 flex items-center justify-between">
				<div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
					{label}
				</div>
				<div className="text-[11px] text-slate-500 dark:text-slate-400">
					{percent}%
				</div>
			</div>
			<div
				className="text-sm font-semibold text-slate-950 dark:text-slate-100"
				title={value.toString()}
			>
				{formattedValue}
			</div>
			<div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
				<div
					className={`h-full ${color} transition-all duration-500 ease-out`}
					style={{ width: `${percent}%` }}
				/>
			</div>
		</div>
	);
}
