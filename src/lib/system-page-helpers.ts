/**
 * @notice System 页面展示辅助工具。
 * @dev 定义系统页文案，并提供基础布尔值展示格式化能力。
 */
import { BRANDING } from "@/lib/branding";

/**
 * @notice System 页面静态文案集合。
 * @dev 供合约地址、治理参数和区块浏览器入口等 UI 区域复用。
 */
export const SYSTEM_PAGE_COPY = {
  headerEyebrow: "Contracts / Roles / Treasury",
  headerTitle: "System Overview",
  headerDescription: "查看当前合约绑定关系、治理参数以及金库状态。",
  openExplorer: `打开 ${BRANDING.explorerName}`,
  contractAddress: "合约地址",
  owner: "所有者",
  votesContract: "投票合约",
  treasuryContract: "金库合约",
  editLockVotes: "编辑锁定票数",
  allowDeleteAfterVote: "投票后允许删除",
  maxVersionsPerContent: "单内容最大版本数",
  cycleBudget: "周期预算",
  cycleSpent: "周期已用",
  governanceToken: "治理代币",
  lateQuorumExtension: "法定人数延长",
  minDelay: "最小延迟",
  trueLabel: "是",
  falseLabel: "否",
  explorerAction: `在 ${BRANDING.explorerName} 查看`,
  blockUnit: "个区块",
  secondsUnit: "秒",
} as const;

/**
 * @notice 将未知值格式化为系统页使用的布尔展示文案。
 * @param value 待格式化的输入值。
 * @returns 布尔值对应的文案；若输入不是布尔值则返回 `-`。
 */
export function formatSystemBoolean(value: unknown) {
  if (typeof value !== "boolean") {
    return "-";
  }

  return value ? SYSTEM_PAGE_COPY.trueLabel : SYSTEM_PAGE_COPY.falseLabel;
}
