import { formatEther } from "viem";

import { BRANDING } from "@/lib/branding";
import type { ContentData } from "@/types/content";

export type ContentFilter = "all" | "active" | "deleted";
export type ContentSort = "updated_desc" | "votes_desc" | "version_desc";

export const PROFILE_PAGE_COPY = {
  headerEyebrow: "Wallet / Content / Governance",
  headerTitle: "Profile",
  headerDescription:
    "集中查看当前钱包的内容记录、治理参与、质押状态与待领奖励。",
  refresh: "刷新数据",
  connectTitle: "连接钱包后查看个人中心",
  connectDescription:
    "个人中心需要读取当前钱包的链上状态。连接后会显示你的内容、提案、质押与奖励信息。",
  connectHint: "请先在右上角连接钱包。",
  summaryAddress: "当前地址",
  summaryVotes: "投票权",
  summaryStaked: "已激活质押",
  summaryPendingStake: "待激活质押",
  summaryPendingWithdraw: "待提取金额",
  summaryPendingRewards: "待领奖励",
  summaryMyContents: "我的内容",
  summaryMyProposals: "我发起的提案",
  summaryAddressHelp: "当前连接的钱包地址",
  summaryVotesHelp: "当前可用于治理投票的权重",
  summaryStakedHelp: "已经生效并参与投票权计算",
  summaryPendingStakeHelp: "已存入但尚未激活的质押",
  summaryPendingWithdrawHelp: "退出申请后等待提取的金额",
  summaryPendingRewardsHelp: "当前可从 Treasury 领取的奖励",
  summaryMyContentsHelp: "正常 {active} 条，已删除 {deleted} 条",
  summaryMyProposalsHelp: "按创建区块倒序统计",
  myContentsTitle: "我的内容",
  myContentsDescription: "共 {count} 条内容，可按状态筛选并切换排序方式。",
  myProposalsTitle: "我发起的提案",
  myProposalsDescription: "共 {count} 个提案，支持固定高度滚动查看。",
  sortLabel: "排序",
  latestFirst: "最近更新",
  votesFirst: "票数优先",
  versionsFirst: "版本数优先",
  filterAll: "全部",
  filterActive: "正常内容",
  filterDeleted: "已删除",
  reloadContents: "重新加载内容",
  reloadProposals: "重新加载提案",
  loadingContents: "正在加载你的内容...",
  loadingProposals: "正在加载你的提案...",
  noContents: "你还没有发布过内容。",
  noFilteredContents: "当前筛选条件下没有匹配的内容。",
  noProposals: "你还没有发起过提案。",
  noDescription: "暂无描述",
  contentIdPrefix: "内容 #",
  versionPrefix: "v",
  statusDeleted: "已删除",
  statusActive: "正常",
  updatedAt: "最近更新时间",
  voteCount: "当前票数",
  currentCid: "当前 CID",
  viewDetail: "查看详情",
  openFile: "打开文件",
  proposalIdPrefix: "提案 #",
  noProposalDescription: "无描述提案",
  proposalActionsTitle: "提案动作",
  noActionSummary: "暂无可展示的动作摘要。",
  moreActions: "另外还有 {count} 个动作，进入详情页可查看完整内容。",
  createdBlock: "创建区块",
  voteRange: "投票区间",
  actionCount: "动作数量",
  viewProposal: "查看提案",
  recentFirst: "最近创建的提案会优先显示在上方。",
  loadMyContentsFailed: "加载我的内容失败",
  loadMyProposalsFailed: "加载我发起的提案失败",
  refreshProfileFailed: "刷新个人内容失败",
  retry: "重试",
  currentCidLabel: "当前 CID",
} as const;

export const CONTENT_FILTER_OPTIONS: Array<{ value: ContentFilter; label: string }> = [
  { value: "all", label: PROFILE_PAGE_COPY.filterAll },
  { value: "active", label: PROFILE_PAGE_COPY.filterActive },
  { value: "deleted", label: PROFILE_PAGE_COPY.filterDeleted },
];

export const CONTENT_SORT_OPTIONS: Array<{ value: ContentSort; label: string }> = [
  { value: "updated_desc", label: PROFILE_PAGE_COPY.latestFirst },
  { value: "votes_desc", label: PROFILE_PAGE_COPY.votesFirst },
  { value: "version_desc", label: PROFILE_PAGE_COPY.versionsFirst },
];

export function formatProfileDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function shortenCid(cid: string) {
  if (cid.length <= 16) {
    return cid;
  }

  return `${cid.slice(0, 8)}...${cid.slice(-8)}`;
}

export function shortenProposalId(proposalId: bigint) {
  const value = proposalId.toString();
  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 30)}...`;
}

export function shortenAddress(address?: string | null) {
  if (!address) return "未连接";
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenValue(amount: bigint) {
  return `${formatEther(amount)} ${BRANDING.nativeTokenSymbol}`;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return `${fallback}：${error.message}`;
  }

  return fallback;
}

export function getVisibleContents(
  myContents: ContentData[],
  contentFilter: ContentFilter,
  contentSort: ContentSort
) {
  const filtered = myContents.filter((item) => {
    if (contentFilter === "active") return !item.deleted;
    if (contentFilter === "deleted") return item.deleted;
    return true;
  });

  return [...filtered].sort((left, right) => {
    switch (contentSort) {
      case "votes_desc":
        return Number(right.voteCount - left.voteCount);
      case "version_desc":
        return Number(right.latestVersion - left.latestVersion);
      case "updated_desc":
      default:
        return Number(right.lastUpdatedAt - left.lastUpdatedAt);
    }
  });
}

export function formatMyContentsHelp(active: number, deleted: number) {
  return PROFILE_PAGE_COPY.summaryMyContentsHelp
    .replace("{active}", String(active))
    .replace("{deleted}", String(deleted));
}

export function formatContentsDescription(count: number) {
  return PROFILE_PAGE_COPY.myContentsDescription.replace("{count}", String(count));
}

export function formatProposalsDescription(count: number) {
  return PROFILE_PAGE_COPY.myProposalsDescription.replace("{count}", String(count));
}

export function formatMoreActions(count: number) {
  return PROFILE_PAGE_COPY.moreActions.replace("{count}", String(count));
}
