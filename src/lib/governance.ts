import { keccak256, parseAbiItem, stringToBytes, toHex } from "viem";

import type { Address, HexString } from "@/types/contracts";
import type { ProposalItem } from "@/types/governance";

export const proposalCreatedEvent = parseAbiItem(
	"event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"
);

type ProposalCreatedArgs = {
	proposalId?: bigint;
	proposer?: Address;
	targets?: readonly Address[];
	values?: readonly bigint[];
	calldatas?: readonly HexString[];
	voteStart?: bigint;
	voteEnd?: bigint;
	description?: string;
};

type ProposalCreatedLog = {
	args: ProposalCreatedArgs;
	blockNumber?: bigint | null;
	transactionHash?: HexString | null;
};

export function parseProposalCreatedLog(
	log: ProposalCreatedLog
): ProposalItem {
	const args = log.args;

	if (
		args.proposalId === undefined ||
		args.proposer === undefined ||
		args.targets === undefined ||
		args.values === undefined ||
		args.calldatas === undefined ||
		args.voteStart === undefined ||
		args.voteEnd === undefined ||
		args.description === undefined
	) {
		throw new Error("Incomplete ProposalCreated log");
	}

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
		transactionHash: log.transactionHash ?? undefined,
	};
}

export function governanceStateLabel(state?: bigint) {
	switch (Number(state ?? -1)) {
		case 0:
			return "待开始";
		case 1:
			return "投票中";
		case 2:
			return "已取消";
		case 3:
			return "未通过";
		case 4:
			return "已通过";
		case 5:
			return "已排队";
		case 6:
			return "已过期";
		case 7:
			return "已执行";
		default:
			return "未知状态";
	}
}

export function governanceStateBadgeClass(state?: bigint) {
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

export function formatProposalBlockRange(start?: bigint, end?: bigint) {
	if (start === undefined || end === undefined) return "-";
	return `${start.toString()} → ${end.toString()}`;
}
