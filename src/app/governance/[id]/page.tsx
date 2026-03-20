"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { keccak256, parseAbiItem, stringToBytes, toHex } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { toast } from "sonner";
import {
	ArrowLeft,
	CheckCircle2,
	ExternalLink,
	Gavel,
	Vote as VoteIcon,
	RefreshCw,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { AddressBadge } from "@/components/address-badge";
import { ABIS, CONTRACTS } from "@/contracts";
import { txToast } from "@/lib/tx-toast";
import { BRANDING } from "@/lib/branding";
import type { ProposalItem, ProposalVotes } from "@/types/governance";
import type { HexString } from "@/types/contracts";
import { asBigInt, asProposalVotes } from "@/lib/web3-types";

// 解析 ProposalCreated 事件的 ABI
const proposalCreatedEvent = parseAbiItem(
	"event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"
);

function explorerProposalUrl(txHash: string) {
	if (!txHash || txHash === "0x") return "#";
	return `${BRANDING.explorerUrl}/tx/${txHash}`;
}

function stateLabel(state?: bigint) {
	switch (Number(state ?? -1)) {
		case 0: return "待处理";
		case 1: return "投票中";
		case 2: return "已取消";
		case 3: return "未通过";
		case 4: return "已通过";
		case 5: return "已排队";
		case 6: return "已过期";
		case 7: return "已执行";
		default: return "未知";
	}
}

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

function shortenAddress(address: string) {
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ProposalDetailPage() {
	const params = useParams();
	const publicClient = usePublicClient();
	const { address } = useAccount();
	const { writeContractAsync } = useWriteContract();

	// [融合] 恢复 proposalDetail 状态以存储详细事件数据
	const [proposalDetail, setProposalDetail] = useState<ProposalItem | null>(null);
	const [loadingDetail, setLoadingDetail] = useState(false);

	const proposalId = useMemo(() => {
		if (!params?.id) return null;
		const raw = params.id as string;
		if (!/^\d+$/.test(raw)) return null;
		return BigInt(raw);
	}, [params]);

	// 基础链上数据
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

	const proposalState = asBigInt(state);

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

	// [融合] 恢复轻量级事件监听，仅获取当前提案详情
	useEffect(() => {
		async function loadProposalDetail() {
			if (!publicClient || proposalId === null) {
				setProposalDetail(null);
				return;
			}

			setLoadingDetail(true);
			try {
				// 优化：实际生产中建议限制 fromBlock 为合约部署块，这里为了演示保持动态获取最新块
				const latestBlock = await publicClient.getBlockNumber();

				// 注意：如果提案 ID 非常大且链很长，全量扫描可能会慢。
				// 优化策略：可以根据业务需求限制扫描范围，或使用索引器。
				const logs = await publicClient.getLogs({
					address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
					event: proposalCreatedEvent,
					fromBlock: 0n,
					toBlock: latestBlock,
				});

				const matched = logs.find((log) => {
					const args = log.args as { proposalId: bigint };
					return args.proposalId === proposalId;
				});

				if (!matched) {
					setProposalDetail(null);
					return;
				}

				const txHash = matched.transactionHash;

				const args = matched.args as {
					proposalId: bigint;
					proposer: `0x${string}`;
					targets: readonly `0x${string}`[];
					values: readonly bigint[];
					calldatas: readonly HexString[];
					voteStart: bigint;
					voteEnd: bigint;
					description: string;
				};

				setProposalDetail({
					proposalId: args.proposalId,
					proposer: args.proposer,
					targets: args.targets,
					values: args.values,
					calldatas: args.calldatas,
					voteStart: args.voteStart,
					voteEnd: args.voteEnd,
					description: args.description,
					descriptionHash: keccak256(toHex(stringToBytes(args.description))),
					blockNumber: matched.blockNumber ?? 0n,
					transactionHash: txHash,
				});
			} catch (error) {
				console.error(error);
				// 非致命错误，不阻断页面，只是详情不显示
			} finally {
				setLoadingDetail(false);
			}
		}

		loadProposalDetail();
	}, [publicClient, proposalId]);

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
		if (!proposalDetail || !address) {
			toast.error("提案详情数据未加载，无法执行排队操作");
			return;
		}

		await txToast(
			writeContractAsync({
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
			}),
			"正在提交排队交易...",
			"排队交易已提交",
			"排队失败"
		);
	}

	async function executeProposal() {
		if (!proposalDetail || !address) {
			toast.error("提案详情数据未加载，无法执行操作");
			return;
		}

		await txToast(
			writeContractAsync({
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
			}),
			"正在提交执行交易...",
			"执行交易已提交",
			"执行失败"
		);
	}

	const handleRefresh = () => {
		refetchState();
		refetchVotes();
		// 触发 effect 重新运行通常不需要手动操作，因为依赖项没变
		// 但如果想强制重跑 effect，可以加一个 key 或者手动调用 loadProposalDetail
		// 这里简单起见，重新挂载组件或提示用户
		window.location.reload();
	};

	if (!proposalId) return null;

	return (
		<main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
			{/* [融合] 顶部导航与刷新按钮 */}
			<div className="flex items-center justify-between gap-4">
				<Link
					href="/governance"
					className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
				>
					<ArrowLeft className="h-4 w-4" />
					返回提案列表
				</Link>

				<button
					onClick={handleRefresh}
					className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
				>
					<RefreshCw className="h-4 w-4" />
					刷新
				</button>
			</div>

			<PageHeader
				eyebrow={`提案 #${proposalId.toString()}`}
				title={proposalDetail?.description || "治理提案"}
				description="查看提案状态、投票分布，并在详情页直接完成排队 / 执行。"
			/>

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
				{/* 左侧：详细信息 */}
				<div className="space-y-6">

					{/* [融合] 基础信息卡片 */}
					<SectionCard
						title="提案信息"
						description="当前提案的核心链上信息。"
					>
						{loadingDetail ? (
							<div className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">
								正在加载提案详情...
							</div>
						) : !proposalDetail ? (
							<div className="text-sm text-slate-500 dark:text-slate-400">
								未找到该提案的 ProposalCreated 事件记录。可能是一个过期的测试提案。
							</div>
						) : (
							<div className="grid gap-4 md:grid-cols-2">
								<InfoCard label="提案 ID" value={proposalId.toString()} />
								<InfoBadgeCard
									label="状态"
									value={stateLabel(proposalState)}
									className={stateBadgeClass(proposalState)}
								/>
								<InfoCard label="创建区块" value={proposalDetail.blockNumber.toString()} />
								<InfoCard label="投票开始" value={proposalDetail.voteStart.toString()} />
								<InfoCard label="投票结束" value={proposalDetail.voteEnd.toString()} />

								{/* [融合] 提案人信息 */}
								<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 md:col-span-2">
									<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
										提案人
									</div>
									<div className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
										<AddressBadge address={proposalDetail.proposer} />
										<span className="text-slate-500 dark:text-slate-400">
											{shortenAddress(proposalDetail.proposer)}
										</span>
									</div>
								</div>

								<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 md:col-span-2">
									<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
										治理合约
									</div>
									<AddressBadge address={CONTRACTS.KnowledgeGovernor} />
								</div>
							</div>
						)}
					</SectionCard>

					{/* [融合] 投票分布图表 */}
					<SectionCard
						title="投票分布"
						description="赞成 / 反对 / 弃权的当前投票分布。"
					>
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
					</SectionCard>

					{/* [融合] 执行动作列表 (只有加载出详情才显示) */}
					<SectionCard
						title="提案动作"
						description="ProposalCreated 事件中记录的原始执行动作。"
					>
						{loadingDetail ? (
							<div className="text-sm text-slate-500 dark:text-slate-400">
								正在加载执行动作...
							</div>
						) : !proposalDetail ? (
							<div className="text-sm text-slate-500 dark:text-slate-400">
								暂无动作数据。
							</div>
						) : (
							<div className="space-y-4">
								{proposalDetail.targets.length === 0 ? (
									<div className="text-sm text-slate-500 italic">此提案不包含任何链上执行动作。</div>
								) : (
									proposalDetail.targets.map((target, index) => (
										<div
											key={`${target}-${index}`}
											className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50"
										>
											<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
												动作 #{index + 1}
											</div>
											<div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
												<div>
													<span className="text-slate-500 dark:text-slate-400">目标地址: </span>
													<AddressBadge address={target} />
												</div>
												<div>
													<span className="text-slate-500 dark:text-slate-400">价值: </span>
													{proposalDetail.values[index]?.toString() ?? "0"} ETH
												</div>
												<div className="break-all font-mono text-xs bg-slate-200 dark:bg-slate-900 p-2 rounded">
													<span className="text-slate-500 dark:text-slate-400 block mb-1">调用数据: </span>
													{proposalDetail.calldatas[index]}
												</div>
											</div>
										</div>
									))
								)}
							</div>
						)}
					</SectionCard>
				</div>

				{/* 右侧：操作面板 */}
				<div className="space-y-6">
					<SectionCard
						title="操作"
						description="根据提案状态参与投票或执行治理动作。"
					>
						<div className="space-y-3">
							<button
								onClick={() => vote(1)}
								disabled={!canVote}
								className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
							>
								<VoteIcon className="h-4 w-4" />
								投赞成票
							</button>

							<button
								onClick={() => vote(0)}
								disabled={!canVote}
								className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								投反对票
							</button>

							<button
								onClick={() => vote(2)}
								disabled={!canVote}
								className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								弃权
							</button>

							<div className="pt-2 border-t border-slate-200 dark:border-slate-700 my-2"></div>

							<button
								onClick={queueProposal}
								disabled={!canQueue || !proposalDetail}
								className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								加入队列
							</button>

							<button
								onClick={executeProposal}
								disabled={!canExecute || !proposalDetail}
								className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
							>
								<CheckCircle2 className="h-4 w-4" />
								执行提案
							</button>
						</div>
					</SectionCard>

					<SectionCard
						title="浏览器"
						description="在 Chainlens 中查看相关链上记录。"
					>
						<a
							href={proposalDetail?.transactionHash ? explorerProposalUrl(proposalDetail.transactionHash) : "#"}
							target="_blank"
							rel="noreferrer"
							className={`inline-flex items-center gap-2 text-sm font-medium ${proposalDetail?.transactionHash
									? "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
									: "text-slate-400 cursor-not-allowed"
								}`}
							// 如果没有 hash，阻止点击
							onClick={(e) => {
								if (!proposalDetail?.transactionHash) {
									e.preventDefault();
									toast.error("尚未加载到创建提案的交易哈希");
								}
							}}
						>
							在 Chainlens 中查看
							<ExternalLink className="h-4 w-4" />
						</a>
					</SectionCard>

					<SectionCard
						title="摘要"
						description="提案当前状态和可用操作的摘要。"
					>
						<div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
							<div className="flex items-center gap-2">
								<Gavel className="h-4 w-4 text-slate-400 dark:text-slate-500" />
								<span>
									当前状态：<strong>{stateLabel(proposalState)}</strong>
								</span>
							</div>
							<div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed dark:bg-slate-800/50">
								{canVote && (
									<>
										当前提案处于 <strong>投票中</strong> 状态，您可以进行投票。
									</>
								)}
								{canQueue && (
									<>
										当前提案已 <strong>通过</strong>，可以进行<strong>加入队列</strong>操作将其加入执行队列。
									</>
								)}
								{canExecute && (
									<>
										当前提案已 <strong>加入队列</strong> 且等待期结束，可以进行<strong>执行</strong>操作正式执行。
									</>
								)}
								{!canVote && !canQueue && !canExecute && (
									<>当前提案暂时不可操作。请检查是否已结束、被取消或尚未开始。</>
								)}
							</div>
						</div>
					</SectionCard>
				</div>
			</div>
		</main>
	);
}

// --- 内部 UI 组件 (从第一版迁移过来，保持样式一致) ---

function InfoCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
			<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
				{label}
			</div>
			<div className="text-sm font-medium text-slate-900 dark:text-slate-100 break-all">
				{value}
			</div>
		</div>
	);
}

function InfoBadgeCard({
	label,
	value,
	className,
}: {
	label: string;
	value: string;
	className: string;
}) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
			<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
				{label}
			</div>
			<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
				{value}
			</span>
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
	return (
		<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
			<div className="mb-2 flex items-center justify-between">
				<div className="text-sm font-medium text-slate-700 dark:text-slate-200">
					{label}
				</div>
				<div className="text-sm text-slate-500 dark:text-slate-400 font-mono">
					{value.toString()} <span className="mx-1">·</span> {percent}%
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