/**
 * @file Treasury 域类型模块。
 * @description 定义金库预算周期和奖励数据的前端类型结构。
 */
/**
 * @notice Treasury 当前预算周期数据。
 */
export interface TreasuryEpoch {
  epochBudget: bigint
  epochSpent: bigint
}

/**
 * @notice 账户当前待领取奖励数据。
 */
export interface RewardData {
  pendingRewards: bigint
}
