export const REWARD_PAGE_SIZE_OPTIONS = [3, 5, 10] as const;
export const REWARD_HISTORY_FILTERS = ["all", "accrued", "claimed"] as const;

export const REWARDS_PAGE_COPY = {
  timeUnknown: "时间未知",
  loadActivityFailed: "加载奖励记录失败",
  connectWalletFirst: "请先连接钱包",
  noClaimableRewards: "暂无可领取奖励",
  claimLoading: "正在提交领取奖励交易...",
  claimSuccess: "领取奖励交易已提交",
  claimFailed: "领取奖励失败",
  headerEyebrow: "Treasury / Claimable Rewards",
  headerTitle: "Rewards Center",
  headerDescription: "查看当前钱包的可领取奖励、奖励历史和奖励来源。",
  pendingRewardsLabel: "待领取奖励",
  claimButtonIdle: "领取",
  claimButtonLoading: "领取中...",
  pendingRewardsHint: "当前钱包可从金库领取的累计奖励。",
  budgetUsageLabel: "周期预算使用",
  budgetUsageHint: "已使用 {spent} / {budget} {symbol}",
  issuedInEpochLabel: "周期已发放",
  issuedInEpochHint: "当前预算周期内已经发放的奖励。",
  historyTitle: "历史奖励记录",
  historyDescription: "查看最近的奖励记账和奖励领取记录。",
  connectWalletForHistory: "连接钱包后即可查看你的奖励历史记录。",
  loadingHistory: "正在加载奖励记录...",
  emptyHistory: "暂无奖励历史记录。",
  filterAll: "全部",
  filterAccrued: "仅记账",
  filterClaimed: "仅领取",
  badgeAccrued: "已记账",
  badgeClaimed: "已领取",
  viewContentDetail: "查看内容详情",
  viewTransaction: "查看交易",
  claimReceivedByCurrentWallet: "奖励已领取到当前钱包",
  rewardSourcesTitle: "奖励来源",
  rewardSourcesDescription: "按内容查看奖励来自哪篇内容。",
  connectWalletForSources: "连接钱包后即可查看奖励来源。",
  loadingSources: "正在加载奖励来源...",
  emptySources: "暂无内容奖励来源。",
  accrualCountSummary: "内容 #{contentId} / 累计记账 {count} 次",
  latestBlockSummary: "最近区块 #{blockNumber}",
  blockSummary: "区块 #{blockNumber}",
  pageSizePrefix: "每页",
  totalItemsSummary: "共 {count} 条",
  paginationPageSummary: "第 {page} / {totalPages} 页",
  paginationPrev: "上一页",
  paginationNext: "下一页",
} as const;

export function formatRewardDate(timestamp?: bigint) {
  if (timestamp === undefined) {
    return REWARDS_PAGE_COPY.timeUnknown;
  }

  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    hour12: false,
  });
}

export function getRewardHistoryFilterLabel(
  filter: (typeof REWARD_HISTORY_FILTERS)[number]
) {
  switch (filter) {
    case "accrued":
      return REWARDS_PAGE_COPY.filterAccrued;
    case "claimed":
      return REWARDS_PAGE_COPY.filterClaimed;
    case "all":
    default:
      return REWARDS_PAGE_COPY.filterAll;
  }
}

export function formatRewardsPaginationSummary(
  page: number,
  totalPages: number,
  pageSize: number
) {
  return `${REWARDS_PAGE_COPY.paginationPageSummary
    .replace("{page}", String(page))
    .replace("{totalPages}", String(totalPages))} / ${REWARDS_PAGE_COPY.pageSizePrefix} ${pageSize} 条`;
}

export function formatRewardTotalItems(count: number) {
  return REWARDS_PAGE_COPY.totalItemsSummary.replace("{count}", String(count));
}

export function formatRewardBlockSummary(blockNumber: bigint) {
  return REWARDS_PAGE_COPY.blockSummary.replace(
    "{blockNumber}",
    blockNumber.toString()
  );
}
