/**
 * @notice 治理提案解析与状态展示工具。
 * @dev 负责解析 ProposalCreated 事件，并格式化治理状态、投票区间与阶段倒计时。
 */
import { keccak256, stringToBytes, toHex } from "viem";

import { proposalCreatedEvent } from "@/contracts/events";
import { summarizeProposalActions } from "@/lib/proposal-action-summaries";
import type { Address, HexString } from "@/types/contracts";
import type { ProposalItem } from "@/types/governance";

export { proposalCreatedEvent, summarizeProposalActions };

/**
 * @notice ProposalCreated 事件参数结构。
 * @dev 仅抽取当前前端解析提案时所需的事件字段。
 */
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

/**
 * @notice ProposalCreated 日志结构。
 * @dev 在事件参数之外保留区块号和交易哈希。
 */
type ProposalCreatedLog = {
  args: ProposalCreatedArgs;
  blockNumber?: bigint | null;
  transactionHash?: HexString | null;
};

/**
 * @notice 将 ProposalCreated 日志解析为前端提案对象。
 * @param log 原始 ProposalCreated 日志。
 * @returns 解析后的提案对象。
 */
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

/**
 * @notice 获取治理状态值对应的中文标签。
 * @param state 治理状态值。
 * @returns 状态值对应的展示文案。
 */
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

/**
 * @notice 获取治理状态值对应的徽标样式类名。
 * @param state 治理状态值。
 * @returns 对应状态的样式类字符串。
 */
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

/**
 * @notice 格式化提案投票区块范围。
 * @param start 投票起始区块。
 * @param end 投票结束区块。
 * @returns 可展示的区块范围文本。
 */
export function formatProposalBlockRange(start?: bigint, end?: bigint) {
  if (start === undefined || end === undefined) return "-";
  return `${start.toString()} -> ${end.toString()}`;
}

/**
 * @notice 格式化区块倒计时。
 * @param blocks 剩余区块数。
 * @returns 带“区块”单位的倒计时文本。
 */
export function formatBlockCountdown(blocks: bigint) {
  return `${blocks.toString()} 个区块`;
}

/**
 * @notice 生成治理提案在当前状态下的倒计时摘要。
 * @param currentBlock 当前区块号。
 * @param voteStart 投票起始区块。
 * @param voteEnd 投票结束区块。
 * @param state 当前治理状态值。
 * @returns 包含标签与倒计时文本的对象。
 */
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
        value: "投票已通过，等待加入队列",
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

/**
 * @notice 生成治理提案阶段倒计时摘要。
 * @param currentBlock 当前区块号。
 * @param voteStart 投票起始区块。
 * @param voteEnd 投票结束区块。
 * @param state 当前治理状态值。
 * @param proposalEta 提案 ETA。
 * @param nowTs 当前时间戳。
 * @returns 包含标签与阶段提示文本的对象。
 */
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
