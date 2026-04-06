import { formatStakeDuration, formatStakeTimestamp, STAKE_COPY } from "@/lib/stake-display";

export function parseStakeAmountInput(value: string, field: string) {
  if (!value.trim()) {
    return { ok: false as const, error: `${STAKE_COPY.amountRequiredPrefix}${field}` };
  }

  return null;
}

export function getStakeAmountError(
  value: string,
  field: string,
  parseAmount: (value: string, field: string) => bigint | null
) {
  const amount = parseAmount(value, field);
  return amount;
}

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
