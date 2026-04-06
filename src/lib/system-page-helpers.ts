import { BRANDING } from "@/lib/branding";

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

export function formatSystemBoolean(value: unknown) {
  if (typeof value !== "boolean") {
    return "-";
  }

  return value ? SYSTEM_PAGE_COPY.trueLabel : SYSTEM_PAGE_COPY.falseLabel;
}
