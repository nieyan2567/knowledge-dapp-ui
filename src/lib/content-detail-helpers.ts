import type { ContentVersionData } from "@/types/content";

export const CONTENT_DETAIL_COPY = {
  initialVersion: "初始版本",
  fileUpdated: "文件已更新",
  titleUpdated: "标题已更新",
  descriptionUpdated: "描述已更新",
  unchangedMetadata: "元数据未变化",
  loadVersionsFailed: "加载内容版本历史失败",
  unavailable: "内容暂不可用",
  connectWalletFirst: "请先连接钱包",
  updateTitleRequired: "请输入内容标题",
  updateCidRequired: "请先上传新文件或填写新的 CID",
  updateFeeLoading: "更新费用尚未加载完成",
  currentFileTitle: "当前文件",
  currentFileDescription:
    "把记录摘要、文件入口和当前元数据集中到同一处查看。",
  snapshotTitle: "内容快照",
  snapshotDescription: "当前内容记录包含最新快照和版本元数据。",
  versionHistoryTitle: "版本历史",
  versionHistoryDescription:
    "历史 CID 会继续保留，并作为链上版本记录展示。",
  actionsTitle: "内容操作",
  actionsDescription:
    "内容未删除时可以继续投票；奖励记账仅允许作者本人发起，后续新增票数也可以继续记账。",
  editTitle: "新版本编辑",
  editDescription:
    "更新内容会创建一个新的链上版本，并保留旧 CID 作为历史版本。",
} as const;

export function formatContentDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    hour12: false,
  });
}

export function getVersionChangeSummary(
  version: ContentVersionData,
  previousVersion?: ContentVersionData
) {
  if (!previousVersion) {
    return [CONTENT_DETAIL_COPY.initialVersion];
  }

  const changes: string[] = [];

  if (version.ipfsHash !== previousVersion.ipfsHash) {
    changes.push(CONTENT_DETAIL_COPY.fileUpdated);
  }

  if (version.title !== previousVersion.title) {
    changes.push(CONTENT_DETAIL_COPY.titleUpdated);
  }

  if (version.description !== previousVersion.description) {
    changes.push(CONTENT_DETAIL_COPY.descriptionUpdated);
  }

  return changes.length > 0 ? changes : [CONTENT_DETAIL_COPY.unchangedMetadata];
}
