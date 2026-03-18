"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
	encodeFunctionData,
	keccak256,
	parseAbiItem,
	parseEther,
	stringToBytes,
	toHex,
} from "viem";
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
	Link,
	RefreshCw,
	Vote,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import { txToast } from "@/lib/tx-toast";
import { asBigInt, asProposalVotes } from "@/lib/web3-types";
import type { ProposalItem, ProposalVotes } from "@/types/governance";
import type { HexString } from "@/types/contracts";

const proposalCreatedEvent = parseAbiItem(
	"event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"
);

function shortenAddress(address: string) {
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function stateLabel(state?: bigint) {
	switch (Number(state ?? -1)) {
		case 0:
			return "Pending";
		case 1:
			return "Active";
		case 2:
			return "Canceled";
		case 3:
			return "Defeated";
		case 4:
			return "Succeeded";
		case 5:
			return "Queued";
		case 6:
			return "Expired";
		case 7:
			return "Executed";
		default:
			return "Unknown";
	}
}

function stateBadgeClass(state?: bigint) {
	switch (Number(state ?? -1)) {
		case 0:
			return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
		case 1:
			return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
		case 4:
			return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
		case 5:
			return "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300";
		case 7:
			return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
		case 2:
		case 3:
		case 6:
			return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
		default:
			return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
	}
}

function explorerAddressUrl(address: string) {
	return `${BRANDING.explorerUrl}/address/${address}`;
}

function formatBlockRange(start?: bigint, end?: bigint) {
	if (start === undefined || end === undefined) return "-";
	return `${start.toString()} → ${end.toString()}`;
}

export default function GovernancePage() {
	const { address } = useAccount();
	const publicClient = usePublicClient();
	const { writeContractAsync } = useWriteContract();

	const [minVotes, setMinVotes] = useState("10");
	const [rewardPerVote, setRewardPerVote] = useState("0.001");
	const [description, setDescription] = useState(
		"Proposal: update reward rules"
	);

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

			const parsed: ProposalItem[] = logs
				.map((log) => {
					const args = log.args as {
						proposalId: bigint;
						proposer: `0x${string}`;
						targets: readonly `0x${string}`[];
						values: readonly bigint[];
						calldatas: readonly HexString[];
						voteStart: bigint;
						voteEnd: bigint;
						description: string;
					};

					return {
						proposalId: args.proposalId,
						proposer: args.proposer,
						targets: args.targets,
						values: args.values,
						calldatas: args.calldatas,
						voteStart: args.voteStart,
						voteEnd: args.voteEnd,
						description: args.description,
						descriptionHash: keccak256(toHex(stringToBytes(args.description))),
						blockNumber: log.blockNumber ?? 0n,
					};
				})
				.reverse();

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

		await txToast(
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

		setTimeout(() => {
			loadProposals();
		}, 1500);
	}

	return (
		<main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
			<PageHeader
				eyebrow="Governor · Timelock · DAO"
				title="Governance"
				description="Create proposals, browse proposal states, cast votes, and execute governance actions in one place."
				right={
					<div className="flex items-center gap-3">
						<button
							onClick={loadProposals}
							className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
						>
							<RefreshCw className="h-4 w-4" />
							Refresh
						</button>

						<a
							href={explorerAddressUrl(CONTRACTS.KnowledgeGovernor)}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
						>
							View Governor
							<ExternalLink className="h-4 w-4" />
						</a>
					</div>
				}
			/>

			<section className="grid gap-4 md:grid-cols-3">
				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							Proposal Threshold
						</div>
						<Gavel className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{proposalThreshold ? String(proposalThreshold) : "-"}
					</div>
					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						Minimum voting power required to create a proposal.
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							Voting Delay
						</div>
						<Clock3 className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{votingDelay ? String(votingDelay) : "-"}
					</div>
					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						Delay between proposal creation and the start of voting.
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							Voting Period
						</div>
						<Vote className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{votingPeriod ? String(votingPeriod) : "-"}
					</div>
					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						Duration of the active voting window.
					</div>
				</div>
			</section>

			<div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
				<SectionCard
					title="Create Proposal"
					description="Current MVP supports proposing a reward rule update on KnowledgeContent."
				>
					<div className="space-y-4">
						<input
							className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
							value={minVotes}
							onChange={(e) => setMinVotes(e.target.value)}
							placeholder="minVotesToReward"
						/>

						<input
							className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
							value={rewardPerVote}
							onChange={(e) => setRewardPerVote(e.target.value)}
							placeholder="rewardPerVote (ETH)"
						/>

						<textarea
							className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
							rows={4}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="proposal description"
						/>

						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
							This proposal will call:
							<div className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
								setRewardRules({minVotes}, {rewardPerVote})
							</div>
						</div>

						<button
							onClick={handlePropose}
							className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
						>
							Create Proposal
						</button>
					</div>
				</SectionCard>

				<SectionCard
					title="Proposal List"
					description="Browse proposals, inspect their current state, and act on them directly."
				>
					<ProposalList proposals={proposals} loading={loadingProposals} />
				</SectionCard>
			</div>
		</main>
	);
}

function ProposalList({
	proposals,
	loading,
}: {
	proposals: ProposalItem[];
	loading: boolean;
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
				<ProposalCard key={proposal.proposalId.toString()} proposal={proposal} />
			))}
		</div>
	);
}

function ProposalCard({ proposal }: { proposal: ProposalItem }) {
	const { address } = useAccount();
	const { writeContractAsync } = useWriteContract();

	const { data: state } = useReadContract({
		address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
		abi: ABIS.KnowledgeGovernor,
		functionName: "state",
		args: [proposal.proposalId],
	});

	const { data: votes } = useReadContract({
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

	const canVote = Number(proposalState ?? -1) === 1;
	const canQueue = Number(proposalState ?? -1) === 4;
	const canExecute = Number(proposalState ?? -1) === 5;

	async function handleVote(support: 0 | 1 | 2) {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		await txToast(
			writeContractAsync({
				address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
				abi: ABIS.KnowledgeGovernor,
				functionName: "castVote",
				args: [proposal.proposalId, support],
				account: address,
			}),
			"正在提交投票...",
			"投票交易已提交",
			"投票失败"
		);
	}

	async function handleQueue() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		await txToast(
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
			"正在提交 queue 交易...",
			"Queue 交易已提交",
			"Queue 失败"
		);
	}

	async function handleExecute() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		await txToast(
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
			"正在提交 execute 交易...",
			"Execute 交易已提交",
			"Execute 失败"
		);
	}

	return (
		<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0 flex-1">
					<div className="mb-2 flex flex-wrap items-center gap-2">
						<span className="text-sm font-medium text-slate-500 dark:text-slate-400">
							Proposal #{proposal.proposalId.toString()}
						</span>
						<span
							className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${stateBadgeClass(
								proposalState
							)}`}
						>
							{currentStateLabel}
						</span>
					</div>

					<Link
						href={`/governance/${proposal.proposalId}`}
						className="text-lg font-semibold text-slate-950 dark:text-slate-100">
						{proposal.description || "No description"}
					</Link>

					<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
						<span>proposer: {shortenAddress(proposal.proposer)}</span>
						<span>created block: {proposal.blockNumber.toString()}</span>
						<span>
							voting blocks: {formatBlockRange(proposal.voteStart, proposal.voteEnd)}
						</span>
					</div>

					<div className="mt-4 grid gap-3 md:grid-cols-3">
						<VoteStat label="For" value={voteData.forVotes} />
						<VoteStat label="Against" value={voteData.againstVotes} />
						<VoteStat label="Abstain" value={voteData.abstainVotes} />
					</div>
				</div>

				<div className="flex flex-wrap gap-2 lg:w-85 lg:justify-end">
					<button
						onClick={() => handleVote(1)}
						disabled={!canVote}
						className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
					>
						Vote For
					</button>

					<button
						onClick={() => handleVote(0)}
						disabled={!canVote}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
					>
						Vote Against
					</button>

					<button
						onClick={() => handleVote(2)}
						disabled={!canVote}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
					>
						Abstain
					</button>

					<button
						onClick={handleQueue}
						disabled={!canQueue}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
					>
						Queue
					</button>

					<button
						onClick={handleExecute}
						disabled={!canExecute}
						className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
					>
						<CheckCircle2 className="h-4 w-4" />
						Execute
					</button>
				</div>
			</div>
		</div>
	);
}

function VoteStat({ label, value }: { label: string; value: bigint }) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
			<div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
				{label}
			</div>
			<div className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">
				{value.toString()}
			</div>
		</div>
	);
}