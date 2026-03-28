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

export function formatBlockCountdown(blocks: bigint) {
  return `${blocks.toString()} 个区块`;
}

export function getProposalCountdown(
  currentBlock?: bigint,
  voteStart?: bigint,
  voteEnd?: bigint,
  state?: bigint
) {
  if (currentBlock === undefined || voteStart === undefined || voteEnd === undefined) {
    return {
      label: "阶段倒计时",
      value: "等待区块同步",
    };
  }

  switch (Number(state ?? -1)) {
    case 0:
      return voteStart > currentBlock
        ? {
            label: "距开始投票",
            value: formatBlockCountdown(voteStart - currentBlock),
          }
        : {
            label: "阶段倒计时",
            value: "投票即将开始",
          };
    case 1:
      return voteEnd > currentBlock
        ? {
            label: "距结束投票",
            value: formatBlockCountdown(voteEnd - currentBlock),
          }
        : {
            label: "阶段倒计时",
            value: "投票即将结束",
          };
    case 4:
      return {
        label: "阶段状态",
        value: "投票已通过，等待排队",
      };
    case 5:
      return {
        label: "阶段状态",
        value: "已排队，等待执行",
      };
    case 7:
      return {
        label: "阶段状态",
        value: "提案已执行",
      };
    case 2:
    case 3:
    case 6:
      return {
        label: "阶段状态",
        value: "投票已结束",
      };
    default:
      return {
        label: "阶段倒计时",
        value: "等待状态更新",
      };
  }
}

function formatQueuedCountdown(seconds: bigint) {
  if (seconds <= 0n) {
    return "已到执行时间";
  }

  const days = seconds / 86400n;
  const hours = (seconds % 86400n) / 3600n;
  const minutes = (seconds % 3600n) / 60n;
  const secs = seconds % 60n;

  if (days > 0n) {
    return `${days.toString()}天 ${hours.toString()}小时`;
  }

  if (hours > 0n) {
    return `${hours.toString()}小时 ${minutes.toString()}分钟`;
  }

  if (minutes > 0n) {
    return `${minutes.toString()}分钟 ${secs.toString()}秒`;
  }

  return `${secs.toString()}秒`;
}

export function getProposalStageCountdown(
  currentBlock?: bigint,
  voteStart?: bigint,
  voteEnd?: bigint,
  state?: bigint,
  proposalEta?: bigint,
  nowTs?: bigint
) {
  if (currentBlock === undefined || voteStart === undefined || voteEnd === undefined) {
    return {
      label: "阶段倒计时",
      value: "等待区块同步",
    };
  }

  switch (Number(state ?? -1)) {
    case 0:
      return voteStart > currentBlock
        ? {
            label: "距开始投票",
            value: `${(voteStart - currentBlock).toString()} 个区块`,
          }
        : {
            label: "阶段倒计时",
            value: "投票即将开始",
          };
    case 1:
      return voteEnd > currentBlock
        ? {
            label: "距结束投票",
            value: `${(voteEnd - currentBlock).toString()} 个区块`,
          }
        : {
            label: "阶段倒计时",
            value: "投票即将结束",
          };
    case 4:
      return {
        label: "下一步",
        value: "投票已通过，请先加入队列",
      };
    case 5:
      if (proposalEta === undefined || proposalEta <= 0n) {
        return {
          label: "距可执行",
          value: "等待执行时间同步",
        };
      }

      if (nowTs === undefined) {
        return {
          label: "距可执行",
          value: "等待本地时间同步",
        };
      }

      return proposalEta > nowTs
        ? {
            label: "距可执行",
            value: formatQueuedCountdown(proposalEta - nowTs),
          }
        : {
            label: "执行状态",
            value: "现在可以执行",
          };
    case 7:
      return {
        label: "阶段状态",
        value: "提案已执行",
      };
    case 2:
    case 3:
    case 6:
      return {
        label: "阶段状态",
        value: "投票已结束",
      };
    default:
      return {
        label: "阶段倒计时",
        value: "等待状态更新",
      };
  }
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
            {
              label: "单票奖励",
              value: `${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            },
          ],
          rawCalldata: calldata,
        });
      }

      if (
        decoded.functionName === "setContentPolicy" &&
        typeof args[0] === "bigint" &&
        typeof args[1] === "boolean" &&
        typeof args[2] === "bigint"
      ) {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新内容策略",
          description: appendValueSuffix(
            `将编辑锁定票数更新为 ${args[0].toString()}，投票后删除设为${args[1] ? "允许" : "禁止"}，单内容最大版本数设为 ${args[2].toString()}`,
            value
          ),
          details: [
            { label: "编辑锁定票数", value: args[0].toString() },
            { label: "投票后允许删除", value: args[1] ? "允许" : "禁止" },
            { label: "最大版本数", value: args[2].toString() },
          ],
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
          title: "更新金库预算",
          description: appendValueSuffix(
            `将周期时长设为 ${args[0].toString()} 秒，周期预算设为 ${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            value
          ),
          details: [
            { label: "周期时长", value: `${args[0].toString()} 秒` },
            {
              label: "周期预算",
              value: `${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            },
          ],
          rawCalldata: calldata,
        });
      }
    }

    if (isSameAddress(target, CONTRACTS.NativeVotes)) {
      const decoded = decodeFunctionData({
        abi: ABIS.NativeVotes,
        data: calldata,
      });
      const args = decoded.args ?? [];

      if (decoded.functionName === "setCooldownSeconds" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新退出冷却期",
          description: appendValueSuffix(
            `将退出冷却期更新为 ${args[0].toString()} 秒`,
            value
          ),
          details: [{ label: "退出冷却期", value: `${args[0].toString()} 秒` }],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "setActivationBlocks" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新质押激活延迟",
          description: appendValueSuffix(
            `将质押激活延迟更新为 ${args[0].toString()} 个区块`,
            value
          ),
          details: [{ label: "激活延迟", value: `${args[0].toString()} 个区块` }],
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
          details: [
            {
              label: "提案门槛",
              value: `${formatEther(args[0])} ${BRANDING.nativeTokenSymbol}`,
            },
          ],
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
          description: appendValueSuffix(
            `将投票延迟更新为 ${args[0].toString()} 个区块`,
            value
          ),
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
          description: appendValueSuffix(
            `将投票周期更新为 ${args[0].toString()} 个区块`,
            value
          ),
          details: [{ label: "投票周期", value: `${args[0].toString()} 个区块` }],
          rawCalldata: calldata,
        });
      }

      if (
        decoded.functionName === "setLateQuorumVoteExtension" &&
        typeof args[0] === "bigint"
      ) {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新延迟法定人数延长期",
          description: appendValueSuffix(
            `将延迟法定人数延长期更新为 ${args[0].toString()} 个区块`,
            value
          ),
          details: [
            {
              label: "延迟法定人数延长期",
              value: `${args[0].toString()} 个区块`,
            },
          ],
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
          title: "更新时间锁延迟",
          description: appendValueSuffix(
            `将时间锁最小延迟更新为 ${args[0].toString()} 秒`,
            value
          ),
          details: [{ label: "最小延迟", value: `${args[0].toString()} 秒` }],
          rawCalldata: calldata,
        });
      }
    }

    const abi =
      isSameAddress(target, CONTRACTS.KnowledgeContent)
        ? ABIS.KnowledgeContent
        : isSameAddress(target, CONTRACTS.NativeVotes)
          ? ABIS.NativeVotes
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
          `参数：${args.map((arg) => formatGenericArgument(arg)).join("，") || "无"}`,
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
    // Fall through to unknown summary.
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
