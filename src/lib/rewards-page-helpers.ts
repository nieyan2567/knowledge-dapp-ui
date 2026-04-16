/**
 * @notice Rewards 页面展示辅助工具。
 * @dev 定义奖励页分页、筛选和展示文案，并提供日期与分页格式化函数。
 */
export const REWARD_PAGE_SIZE_OPTIONS = [3, 5, 10] as const;
/**
 * @notice 奖励历史页可选分页大小。
 * @dev 控制历史列表每页显示的记录数量。
 */
export const REWARD_HISTORY_FILTERS = ["all", "accrued", "claimed"] as const;

/**
 * @notice Rewards 页面静态文案集合。
 * @dev 供奖励中心页头、历史记录、来源列表和分页控件复用。
 */
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

/**
 * @notice 格式化奖励时间戳。
 * @param timestamp 秒级区块时间戳。
 * @returns 本地化后的时间文本；若时间不存在则返回默认占位文案。
 */
export function formatRewardDate(timestamp?: bigint) {
  if (timestamp === undefined) {
    return REWARDS_PAGE_COPY.timeUnknown;
  }

  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    hour12: false,
  });
}

/**
 * @notice 获取奖励历史筛选条件对应的展示标签。
 * @param filter 当前筛选值。
 * @returns 对应的中文标签文本。
 */
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

/**
 * @notice 生成奖励列表的分页摘要文本。
 * @param page 当前页码。
 * @param totalPages 总页数。
 * @param pageSize 当前每页数量。
 * @returns 组合后的分页摘要文案。
 */
export function formatRewardsPaginationSummary(
  page: number,
  totalPages: number,
  pageSize: number
) {
  return `${REWARDS_PAGE_COPY.paginationPageSummary
    .replace("{page}", String(page))
    .replace("{totalPages}", String(totalPages))} / ${REWARDS_PAGE_COPY.pageSizePrefix} ${pageSize} 条`;
}

/**
 * @notice 生成奖励总条数摘要文本。
 * @param count 当前总记录数。
 * @returns 带有总条数占位替换后的文案。
 */
export function formatRewardTotalItems(count: number) {
  return REWARDS_PAGE_COPY.totalItemsSummary.replace("{count}", String(count));
}

/**
 * @notice 生成区块号摘要文本。
 * @param blockNumber 区块号。
 * @returns 带有区块号的摘要文案。
 */
export function formatRewardBlockSummary(blockNumber: bigint) {
  return REWARDS_PAGE_COPY.blockSummary.replace(
    "{blockNumber}",
    blockNumber.toString()
  );
}
