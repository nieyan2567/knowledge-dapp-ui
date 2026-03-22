import {
	decodeFunctionData,
	formatEther,
	keccak256,
	parseAbiItem,
	stringToBytes,
	toHex,
} from "viem";

import { ABIS, CONTRACTS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import type { Address, HexString } from "@/types/contracts";
import type { ProposalActionSummary, ProposalItem } from "@/types/governance";

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

function isSameAddress(left: string, right: string) {
	return left.toLowerCase() === right.toLowerCase();
}

function getContractLabel(address: Address) {
	if (isSameAddress(address, CONTRACTS.KnowledgeContent)) {
		return "KnowledgeContent";
	}

	if (isSameAddress(address, CONTRACTS.TreasuryNative)) {
		return "TreasuryNative";
	}

	if (isSameAddress(address, CONTRACTS.KnowledgeGovernor)) {
		return "KnowledgeGovernor";
	}

	if (isSameAddress(address, CONTRACTS.TimelockController)) {
		return "TimelockController";
	}

	if (isSameAddress(address, CONTRACTS.NativeVotes)) {
		return "NativeVotes";
	}

	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatGenericArgument(value: unknown): string {
	if (typeof value === "bigint") {
		return value.toString();
	}

	if (Array.isArray(value)) {
		return `[${value.map((item) => formatGenericArgument(item)).join(", ")}]`;
	}

	return String(value);
}

function appendValueSuffix(description: string, value: bigint) {
	if (value === 0n) {
		return description;
	}

	return `${description}，并附带 ${formatEther(value)} ${BRANDING.nativeTokenSymbol}`;
}

function summarizeDecodedAction(
	target: Address,
	value: bigint,
	calldata: HexString
): ProposalActionSummary {
	const targetLabel = getContractLabel(target);

	try {
		if (isSameAddress(target, CONTRACTS.KnowledgeContent)) {
			const decoded = decodeFunctionData({
				abi: ABIS.KnowledgeContent,
				data: calldata,
			});
			const decodedArgs = decoded.args ?? [];

			if (
				decoded.functionName === "setRewardRules" &&
				decodedArgs.length >= 2 &&
				typeof decodedArgs[0] === "bigint" &&
				typeof decodedArgs[1] === "bigint"
			) {
				const [minVotesToReward, rewardPerVote] = decodedArgs;
				return {
					target,
					targetLabel,
					value,
					functionName: decoded.functionName,
					title: "更新奖励规则",
					description: appendValueSuffix(
						`将最小获奖票数设为 ${minVotesToReward.toString()}，单票奖励设为 ${formatEther(
							rewardPerVote
						)} ${BRANDING.nativeTokenSymbol}`,
						value
					),
					rawCalldata: calldata,
				};
			}

			if (
				decoded.functionName === "setTreasury" &&
				decodedArgs.length >= 1 &&
				typeof decodedArgs[0] === "string"
			) {
				return {
					target,
					targetLabel,
					value,
					functionName: decoded.functionName,
					title: "更新 Treasury 地址",
					description: appendValueSuffix(
						`将 Treasury 更新为 ${decodedArgs[0]}`,
						value
					),
					rawCalldata: calldata,
				};
			}
		}

		if (isSameAddress(target, CONTRACTS.TreasuryNative)) {
			const decoded = decodeFunctionData({
				abi: ABIS.TreasuryNative,
				data: calldata,
			});
			const decodedArgs = decoded.args ?? [];

			if (
				decoded.functionName === "setBudget" &&
				decodedArgs.length >= 2 &&
				typeof decodedArgs[0] === "bigint" &&
				typeof decodedArgs[1] === "bigint"
			) {
				const [epochDuration, epochBudget] = decodedArgs;
				return {
					target,
					targetLabel,
					value,
					functionName: decoded.functionName,
					title: "更新 Treasury 预算",
					description: appendValueSuffix(
						`将周期时长设为 ${epochDuration.toString()} 秒，周期预算设为 ${formatEther(
							epochBudget
						)} ${BRANDING.nativeTokenSymbol}`,
						value
					),
					rawCalldata: calldata,
				};
			}
		}

		const abi =
			isSameAddress(target, CONTRACTS.KnowledgeContent)
				? ABIS.KnowledgeContent
				: isSameAddress(target, CONTRACTS.TreasuryNative)
					? ABIS.TreasuryNative
					: isSameAddress(target, CONTRACTS.KnowledgeGovernor)
						? ABIS.KnowledgeGovernor
						: null;

		if (abi) {
			const decoded = decodeFunctionData({
				abi,
				data: calldata,
			});
			const decodedArgs = decoded.args ?? [];

			return {
				target,
				targetLabel,
				value,
				functionName: decoded.functionName,
				title: `调用 ${targetLabel}.${decoded.functionName}`,
				description: appendValueSuffix(
					`参数：${decodedArgs.map((arg) => formatGenericArgument(arg)).join(", ") || "无"}`,
					value
				),
				rawCalldata: calldata,
			};
		}
	} catch {
		// Fall through to raw calldata fallback.
	}

	return {
		target,
		targetLabel,
		value,
		functionName: "unknown",
		title: `调用 ${targetLabel}`,
		description: appendValueSuffix("暂时无法解码该提案动作，下面保留原始 calldata", value),
		rawCalldata: calldata,
	};
}

export function summarizeProposalActions(
	proposal: Pick<ProposalItem, "targets" | "values" | "calldatas">
): ProposalActionSummary[] {
	return proposal.targets.map((target, index) =>
		summarizeDecodedAction(
			target,
			proposal.values[index] ?? 0n,
			proposal.calldatas[index] ?? "0x"
		)
	);
}
