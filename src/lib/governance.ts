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

const ZERO_ROLE = `0x${"00".repeat(32)}` as HexString;
const TIMELOCK_ROLE_LABELS: Record<string, string> = {
  [ZERO_ROLE.toLowerCase()]: "DEFAULT_ADMIN_ROLE",
  "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1":
    "PROPOSER_ROLE",
  "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63":
    "EXECUTOR_ROLE",
  "0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783":
    "CANCELLER_ROLE",
  "0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5":
    "TIMELOCK_ADMIN_ROLE",
};

export function parseProposalCreatedLog(log: ProposalCreatedLog): ProposalItem {
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
  return `${start.toString()} -> ${end.toString()}`;
}

function isSameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function getContractLabel(address: Address) {
  if (isSameAddress(address, CONTRACTS.KnowledgeContent)) return "KnowledgeContent";
  if (isSameAddress(address, CONTRACTS.TreasuryNative)) return "TreasuryNative";
  if (isSameAddress(address, CONTRACTS.KnowledgeGovernor)) return "KnowledgeGovernor";
  if (isSameAddress(address, CONTRACTS.TimelockController)) return "TimelockController";
  if (isSameAddress(address, CONTRACTS.NativeVotes)) return "NativeVotes";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatGenericArgument(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatGenericArgument(item)).join(", ")}]`;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function formatRoleLabel(role: string) {
  return TIMELOCK_ROLE_LABELS[role.toLowerCase()] ?? role;
}

function appendValueSuffix(description: string, value: bigint) {
  if (value === 0n) return description;
  return `${description}，并附带 ${formatEther(value)} ${BRANDING.nativeTokenSymbol}`;
}

function createSummary(input: ProposalActionSummary): ProposalActionSummary {
  return input;
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
      const args = decoded.args ?? [];

      if (
        decoded.functionName === "setRewardRules" &&
        typeof args[0] === "bigint" &&
        typeof args[1] === "bigint"
      ) {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新奖励规则",
          description: appendValueSuffix(
            `将最小获奖票数设为 ${args[0].toString()}，单票奖励设为 ${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            value
          ),
          details: [
            { label: "最小获奖票数", value: args[0].toString() },
            { label: "单票奖励", value: `${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}` },
          ],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "setTreasury" && typeof args[0] === "string") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新 Treasury 地址",
          description: appendValueSuffix(`将内容合约的 Treasury 更新为 ${args[0]}`, value),
          details: [{ label: "Treasury", value: args[0] }],
          rawCalldata: calldata,
        });
      }

      if (
        decoded.functionName === "setAntiSybil" &&
        typeof args[0] === "string" &&
        typeof args[1] === "bigint"
      ) {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新 Anti-Sybil 配置",
          description: appendValueSuffix(
            `将 Votes 合约更新为 ${args[0]}，最小质押门槛设为 ${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            value
          ),
          details: [
            { label: "Votes 合约", value: args[0] },
            { label: "最小质押门槛", value: `${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}` },
          ],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "pause" || decoded.functionName === "unpause") {
        const paused = decoded.functionName === "pause";
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: paused ? "暂停内容模块" : "恢复内容模块",
          description: appendValueSuffix(
            paused
              ? "暂停内容注册、投票和奖励相关操作"
              : "恢复内容注册、投票和奖励相关操作",
            value
          ),
          details: [{ label: "模块", value: "KnowledgeContent" }],
          rawCalldata: calldata,
        });
      }
    }

    if (isSameAddress(target, CONTRACTS.TreasuryNative)) {
      const decoded = decodeFunctionData({
        abi: ABIS.TreasuryNative,
        data: calldata,
      });
      const args = decoded.args ?? [];

      if (
        decoded.functionName === "setBudget" &&
        typeof args[0] === "bigint" &&
        typeof args[1] === "bigint"
      ) {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新 Treasury 预算",
          description: appendValueSuffix(
            `将周期时长设为 ${args[0].toString()} 秒，周期预算设为 ${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            value
          ),
          details: [
            { label: "周期时长", value: `${args[0].toString()} 秒` },
            { label: "周期预算", value: `${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}` },
          ],
          rawCalldata: calldata,
        });
      }

      if (
        decoded.functionName === "setSpender" &&
        typeof args[0] === "string" &&
        typeof args[1] === "boolean"
      ) {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新 Treasury Spender 权限",
          description: appendValueSuffix(
            `${args[1] ? "授予" : "撤销"} ${args[0]} 的 spender 权限`,
            value
          ),
          details: [
            { label: "Spender", value: args[0] },
            { label: "权限", value: args[1] ? "允许" : "撤销" },
          ],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "pause" || decoded.functionName === "unpause") {
        const paused = decoded.functionName === "pause";
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: paused ? "暂停 Treasury" : "恢复 Treasury",
          description: appendValueSuffix(
            paused ? "暂停 Treasury 的敏感链上操作" : "恢复 Treasury 的敏感链上操作",
            value
          ),
          details: [{ label: "模块", value: "TreasuryNative" }],
          rawCalldata: calldata,
        });
      }
    }

    if (isSameAddress(target, CONTRACTS.KnowledgeGovernor)) {
      const decoded = decodeFunctionData({
        abi: ABIS.KnowledgeGovernor,
        data: calldata,
      });
      const args = decoded.args ?? [];

      if (decoded.functionName === "setProposalThreshold" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新提案门槛",
          description: appendValueSuffix(
            `将提案门槛更新为 ${formatEther(args[0])} ${BRANDING.nativeTokenSymbol}`,
            value
          ),
          details: [{ label: "提案门槛", value: `${formatEther(args[0])} ${BRANDING.nativeTokenSymbol}` }],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "setVotingDelay" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新投票延迟",
          description: appendValueSuffix(`将投票延迟更新为 ${args[0].toString()} 个区块`, value),
          details: [{ label: "投票延迟", value: `${args[0].toString()} 个区块` }],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "setVotingPeriod" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新投票周期",
          description: appendValueSuffix(`将投票周期更新为 ${args[0].toString()} 个区块`, value),
          details: [{ label: "投票周期", value: `${args[0].toString()} 个区块` }],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "updateQuorumNumerator" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新法定人数分子",
          description: appendValueSuffix(`将法定人数分子更新为 ${args[0].toString()}`, value),
          details: [{ label: "法定人数分子", value: args[0].toString() }],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "updateTimelock" && typeof args[0] === "string") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新 Governor Timelock",
          description: appendValueSuffix(`将 Governor 使用的 Timelock 更新为 ${args[0]}`, value),
          details: [{ label: "Timelock", value: args[0] }],
          rawCalldata: calldata,
        });
      }
    }

    if (isSameAddress(target, CONTRACTS.TimelockController)) {
      const decoded = decodeFunctionData({
        abi: ABIS.TimelockController,
        data: calldata,
      });
      const args = decoded.args ?? [];

      if (decoded.functionName === "updateDelay" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新 Timelock 延迟",
          description: appendValueSuffix(`将 Timelock 最小延迟更新为 ${args[0].toString()} 秒`, value),
          details: [{ label: "最小延迟", value: `${args[0].toString()} 秒` }],
          rawCalldata: calldata,
        });
      }

      if (
        (decoded.functionName === "grantRole" || decoded.functionName === "revokeRole") &&
        typeof args[0] === "string" &&
        typeof args[1] === "string"
      ) {
        const granting = decoded.functionName === "grantRole";
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: granting ? "授予 Timelock 角色" : "撤销 Timelock 角色",
          description: appendValueSuffix(
            `${granting ? "授予" : "撤销"} ${args[1]} 的 ${formatRoleLabel(args[0])} 权限`,
            value
          ),
          details: [
            { label: "角色", value: formatRoleLabel(args[0]) },
            { label: "账户", value: args[1] },
            { label: "操作", value: granting ? "grantRole" : "revokeRole" },
          ],
          rawCalldata: calldata,
        });
      }
    }

    const abi =
      isSameAddress(target, CONTRACTS.KnowledgeContent)
        ? ABIS.KnowledgeContent
        : isSameAddress(target, CONTRACTS.TreasuryNative)
          ? ABIS.TreasuryNative
          : isSameAddress(target, CONTRACTS.KnowledgeGovernor)
            ? ABIS.KnowledgeGovernor
            : isSameAddress(target, CONTRACTS.TimelockController)
              ? ABIS.TimelockController
              : null;

    if (abi) {
      const decoded = decodeFunctionData({
        abi,
        data: calldata,
      });
      const args = decoded.args ?? [];

      return createSummary({
        target,
        targetLabel,
        value,
        functionName: decoded.functionName,
        title: `调用 ${targetLabel}.${decoded.functionName}`,
        description: appendValueSuffix(
          `参数: ${args.map((arg) => formatGenericArgument(arg)).join(", ") || "无"}`,
          value
        ),
        details: args.map((arg, index) => ({
          label: `参数 ${index + 1}`,
          value: formatGenericArgument(arg),
        })),
        rawCalldata: calldata,
      });
    }
  } catch {
    // Fall through.
  }

  return createSummary({
    target,
    targetLabel,
    value,
    functionName: "unknown",
    title: `调用 ${targetLabel}`,
    description: appendValueSuffix("暂时无法解码该提案动作，下面保留原始 calldata", value),
    rawCalldata: calldata,
  });
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
