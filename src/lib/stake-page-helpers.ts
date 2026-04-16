/**
 * @notice Stake 页面状态与文案辅助工具。
 * @dev 负责质押金额校验、流程阶段判断以及辅助提示文案生成。
 */
import { formatStakeDuration, formatStakeTimestamp, STAKE_COPY } from "@/lib/stake-display";

/**
 * @notice 校验质押输入是否为空。
 * @param value 当前输入值。
 * @param field 当前字段名称。
 * @returns 若输入为空则返回错误对象，否则返回 `null`。
 */
export function parseStakeAmountInput(value: string, field: string) {
  if (!value.trim()) {
    return { ok: false as const, error: `${STAKE_COPY.amountRequiredPrefix}${field}` };
  }

  return null;
}

/**
 * @notice 通过外部解析函数获取质押金额校验结果。
 * @param value 当前输入值。
 * @param field 当前字段名称。
 * @param parseAmount 实际执行金额解析的函数。
 * @returns 解析后的金额；若解析失败则返回 `null`。
 */
export function getStakeAmountError(
  value: string,
  field: string,
  parseAmount: (value: string, field: string) => bigint | null
) {
  const amount = parseAmount(value, field);
  return amount;
}

/**
 * @notice 生成 Activate 区域的辅助提示文案。
 * @param input 生成提示所需的状态集合。
 * @param input.address 当前钱包地址。
 * @param input.hasPendingStake 是否存在待激活质押。
 * @param input.activateRemainingBlocks 距离可激活还需等待的区块数。
 * @param input.activateAfterBlockValue 可激活目标区块号。
 * @returns 对应当前状态的辅助提示文本。
 */
export function getActivateHelperText(input: {
  address?: string;
  hasPendingStake: boolean;
  activateRemainingBlocks: bigint;
  activateAfterBlockValue: bigint;
}) {
  const { address, hasPendingStake, activateRemainingBlocks, activateAfterBlockValue } = input;

  if (!address) {
    return STAKE_COPY.activateHelperDisconnected;
  }

  if (!hasPendingStake) {
    return STAKE_COPY.activateHelperEmpty;
  }

  if (activateRemainingBlocks > 0n) {
    return STAKE_COPY.activateHelperWaiting
      .replace("{blocks}", activateRemainingBlocks.toString())
      .replace("{targetBlock}", activateAfterBlockValue.toString());
  }

  return STAKE_COPY.activateHelperReady;
}

/**
 * @notice 生成 Withdraw 区域的辅助提示文案。
 * @param input 生成提示所需的状态集合。
 * @param input.address 当前钱包地址。
 * @param input.hasPendingWithdraw 是否存在待提取余额。
 * @param input.withdrawRemainingSeconds 距离可提取还需等待的秒数。
 * @param input.withdrawAfterTimeValue 可提取的目标时间戳。
 * @returns 对应当前状态的辅助提示文本。
 */
export function getWithdrawHelperText(input: {
  address?: string;
  hasPendingWithdraw: boolean;
  withdrawRemainingSeconds: bigint;
  withdrawAfterTimeValue: bigint;
}) {
  const { address, hasPendingWithdraw, withdrawRemainingSeconds, withdrawAfterTimeValue } = input;

  if (!address) {
    return STAKE_COPY.withdrawHelperDisconnected;
  }

  if (!hasPendingWithdraw) {
    return STAKE_COPY.withdrawHelperEmpty;
  }

  if (withdrawRemainingSeconds > 0n) {
    return STAKE_COPY.withdrawHelperWaiting
      .replace("{duration}", formatStakeDuration(withdrawRemainingSeconds))
      .replace("{time}", formatStakeTimestamp(withdrawAfterTimeValue));
  }

  return STAKE_COPY.withdrawHelperReady;
}

/**
 * @notice 推导 Stake 流程中当前高亮的步骤编号。
 * @param input 影响流程阶段判断的状态集合。
 * @param input.hasPendingWithdraw 是否存在待提取余额。
 * @param input.withdrawRemainingSeconds 待提取余额剩余冷却秒数。
 * @param input.hasPendingStake 是否存在待激活质押。
 * @param input.stakedValue 当前已激活质押数量。
 * @returns Stake 流程图中应高亮的步骤编号。
 */
export function getActiveStakeFlowStep(input: {
  hasPendingWithdraw: boolean;
  withdrawRemainingSeconds: bigint;
  hasPendingStake: boolean;
  stakedValue: bigint;
}) {
  const { hasPendingWithdraw, withdrawRemainingSeconds, hasPendingStake, stakedValue } = input;

  if (hasPendingWithdraw) {
    return withdrawRemainingSeconds > 0n ? 3 : 4;
  }

  if (hasPendingStake) {
    return 2;
  }

  if (stakedValue > 0n) {
    return 3;
  }

  return 1;
}

/**
 * @notice 生成 Stake 页面当前阶段说明文案。
 * @param input 当前地址和质押状态集合。
 * @param input.address 当前钱包地址。
 * @param input.hasPendingWithdraw 是否存在待提取余额。
 * @param input.withdrawRemainingSeconds 待提取余额剩余冷却秒数。
 * @param input.hasPendingStake 是否存在待激活质押。
 * @param input.activateRemainingBlocks 待激活剩余区块数。
 * @param input.stakedValue 当前已激活质押数量。
 * @returns 当前阶段的文本说明。
 */
export function getCurrentStakeStageText(input: {
  address?: string;
  hasPendingWithdraw: boolean;
  withdrawRemainingSeconds: bigint;
  hasPendingStake: boolean;
  activateRemainingBlocks: bigint;
  stakedValue: bigint;
}) {
  const {
    address,
    hasPendingWithdraw,
    withdrawRemainingSeconds,
    hasPendingStake,
    activateRemainingBlocks,
    stakedValue,
  } = input;

  if (!address) {
    return STAKE_COPY.stageDisconnected;
  }

  if (hasPendingWithdraw) {
    return withdrawRemainingSeconds > 0n
      ? `${STAKE_COPY.stagePendingWithdrawWaitingPrefix} ${formatStakeDuration(withdrawRemainingSeconds)}`
      : STAKE_COPY.stagePendingWithdrawReady;
  }

  if (hasPendingStake) {
    return activateRemainingBlocks > 0n
      ? `${STAKE_COPY.stagePendingStakeWaitingPrefix} ${activateRemainingBlocks.toString()}${STAKE_COPY.stagePendingStakeWaitingSuffix}`
      : STAKE_COPY.stagePendingStakeReady;
  }

  if (stakedValue > 0n) {
    return STAKE_COPY.stageHasVotes;
  }

  return STAKE_COPY.stageIdle;
}
