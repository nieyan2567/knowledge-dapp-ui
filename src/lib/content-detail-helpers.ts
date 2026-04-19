/**
 * @notice Content 详情页展示辅助工具。
 * @dev 定义详情页文案、版本变更摘要、奖励状态展示以及状态摘要构造逻辑。
 */
import type { ContentVersionData } from "@/types/content";

/**
 * @notice Content 详情页静态文案集合。
 * @dev 供当前文件、版本历史、操作区和状态摘要区域复用。
 */
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
  loadingDetail: "正在加载内容详情...",
  backToList: "返回内容列表",
  notFound: "未找到该内容。",
  previewCurrentFile: "查看当前 IPFS 文件",
  noDescription: "暂无描述",
  recordSummaryTitle: "记录摘要",
  contentIdLabel: "内容 ID",
  latestVersionLabel: "最新版本",
  statusLabel: "状态",
  statusNormal: "正常",
  statusDeleted: "已删除",
  titleLabel: "标题",
  descriptionLabel: "描述",
  openCurrentFileTitle: "打开文件",
  activeVersionText: "当前激活版本为 v{version}",
  openFile: "打开文件",
  currentMetadataTitle: "当前元数据",
  currentCidLabel: "当前 CID",
  gatewayUrlLabel: "网关地址",
  authorLabel: "作者",
  createdAtLabel: "创建时间",
  latestVersionSummaryLabel: "最新版本",
  updatedAtLabel: "最后更新时间",
  votesLabel: "票数",
  rewardStatusLabel: "奖励状态",
  rewardStatusNone: "未记账",
  rewardStatusCount: "第 {count} 次记账",
  loadingVersionHistory: "正在加载版本历史...",
  emptyVersionHistory: "暂无版本记录。",
  versionPrefix: "版本 v{version}",
  recordedAtPrefix: "记录时间：{time}",
  currentVersionBadge: "当前版本",
  historicalVersionBadge: "历史版本",
  changeSummaryTitle: "变更摘要",
  comparedToVersion: "相较 v{version} 的变化",
  initialVersionRecord: "这是内容的初始版本记录。",
  versionTitlePrefix: "标题：",
  versionDescriptionPrefix: "描述：",
  versionCidPrefix: "CID：",
  copyCid: "复制 CID",
  voteButton: "投票",
  accrueRewardButton: "奖励记账",
  accrueRewardAuthorOnly: "当前账号不是内容作者，不能为这条内容发起奖励记账。",
  restoreButton: "恢复内容",
  restoreLoading: "正在恢复...",
  uploadVersionTitle: "上传新版本文件",
  uploadVersionDescription:
    "单文件大小上限：{maxSize}。上传成功后会自动把新 CID 回填到下方输入框。",
  uploadVersionAuthenticating: "正在验证上传身份...",
  uploadVersionLoading: "正在上传新版本文件...",
  uploadVersionIdle: "上传新版本文件",
  titlePlaceholder: "内容标题",
  descriptionPlaceholder: "内容描述",
  newCidPlaceholder: "新的 IPFS CID",
  newVersionGatewayUrlLabel: "新版本网关地址",
  updateFeeTitle: "新版本更新费用",
  loadingFee: "正在读取费用...",
  freeNow: "当前免费",
  updateFeeDescription:
    "创建新版本时会把这笔费用转入协议金库，用于约束低成本刷版本。",
  editHintEditable:
    "你现在可以直接修改标题和描述，也可以先上传一个新的文件生成新 CID，再提交链上更新。",
  editHintAuthorBlocked:
    "当前内容状态受到合约规则限制，表单仍可查看，但提交时会按链上规则校验。",
  editHintNonAuthor:
    "你可以先准备标题、描述和新 CID；只有作者地址才能真正提交新版本。",
  createVersionIdle: "创建新版本",
  createVersionLoading: "正在创建新版本...",
  deleteButton: "软删除",
  deleteButtonLoading: "正在删除...",
  statusSummaryAuthor: "作者权限",
  statusSummaryContentState: "内容状态",
  statusSummaryEditability: "新版本权限",
  statusSummaryVersionBudget: "版本额度",
  statusSummaryAuthorEditable: "当前账号可编辑",
  statusSummaryAuthorReadonly: "当前账号仅可查看",
  statusSummaryAuthorEditableDesc: "你可以管理版本、删除和恢复状态。",
  statusSummaryAuthorReadonlyDesc: "只有作者地址可以提交新版本或恢复内容。",
  statusSummaryDeletedDesc: "恢复后才能继续创建新版本。",
  statusSummaryActiveDesc: "当前内容仍可参与浏览、投票与奖励流程。",
  statusSummaryVersionAllowed: "当前可创建新版本",
  statusSummaryVersionBlocked: "当前不可创建",
  statusSummaryVersionAllowedDesc:
    "标题、描述和文件变更都可以提交为新版本。",
  statusSummaryNoLimit: "当前合约未返回版本上限。",
  statusSummaryVersionUsed: "当前已使用 {count} 个版本名额。",
  uploadVersionFileRequired: "请先选择新版本文件",
  uploadVersionFailed: "新版本文件上传失败",
  uploadVersionSuccess: "新版本文件上传成功",
  uploadVersionLoadingToast: "正在上传新版本文件到 IPFS...",
  voteLoading: "正在提交投票...",
  voteSuccess: "投票交易已提交",
  voteFail: "投票失败",
  accrueRewardAuthorOnlyShort: "只有内容作者可以发起奖励记账",
  accrueRewardLoading: "正在提交奖励记账...",
  accrueRewardSuccess: "奖励记账交易已提交",
  accrueRewardFail: "奖励记账失败",
  updateBlocked: "当前内容状态不允许创建新版本",
  updateLoading: "正在提交新版本...",
  updateSuccess: "新版本交易已提交",
  updateFail: "创建新版本失败",
  deleteBlocked: "当前内容状态不允许删除",
  deleteLoading: "正在提交删除交易...",
  deleteSuccess: "删除交易已提交",
  deleteFail: "删除失败",
  restoreBlocked: "当前内容状态不允许恢复",
  restoreTxLoading: "正在提交恢复交易...",
  restoreTxSuccess: "恢复交易已提交",
  restoreTxFail: "恢复失败",
} as const;

/**
 * @notice 格式化内容相关时间戳。
 * @param timestamp 秒级时间戳。
 * @returns 本地化后的日期时间字符串。
 */
export function formatContentDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    hour12: false,
  });
}

/**
 * @notice 比较当前版本与上一版本，生成变更摘要。
 * @param version 当前版本。
 * @param previousVersion 上一个版本；若不存在则视为初始版本。
 * @returns 表示本次变更点的文案列表。
 */
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

/**
 * @notice 格式化奖励状态文案。
 * @param rewardAccrualCount 奖励记账次数。
 * @returns 奖励状态对应的展示文本。
 */
export function formatRewardStatus(rewardAccrualCount: bigint) {
  return rewardAccrualCount > 0n
    ? CONTENT_DETAIL_COPY.rewardStatusCount.replace(
        "{count}",
        rewardAccrualCount.toString()
      )
    : CONTENT_DETAIL_COPY.rewardStatusNone;
}

/**
 * @notice 生成版本记录时间文案。
 * @param timestamp 版本记录时间戳。
 * @returns 带占位替换的记录时间文案。
 */
export function formatVersionRecordedAt(timestamp: bigint) {
  return CONTENT_DETAIL_COPY.recordedAtPrefix.replace(
    "{time}",
    formatContentDate(timestamp)
  );
}

/**
 * @notice 生成版本对比说明文案。
 * @param version 被对比的历史版本号。
 * @returns 带版本号的对比说明文本。
 */
export function formatComparedVersion(version: bigint) {
  return CONTENT_DETAIL_COPY.comparedToVersion.replace(
    "{version}",
    version.toString()
  );
}

/**
 * @notice 生成当前激活版本提示文案。
 * @param version 当前激活版本号。
 * @returns 带版本号的激活版本文本。
 */
export function formatActiveVersionText(version: bigint) {
  return CONTENT_DETAIL_COPY.activeVersionText.replace(
    "{version}",
    version.toString()
  );
}

/**
 * @notice 生成新版本上传区域说明文案。
 * @param maxSize 上传大小上限文本。
 * @returns 替换占位后的说明文本。
 */
export function formatUploadVersionDescription(maxSize: string) {
  return CONTENT_DETAIL_COPY.uploadVersionDescription.replace("{maxSize}", maxSize);
}

/**
 * @notice 构造内容状态摘要卡片数据。
 * @param input 状态摘要所需输入。
 * @param input.isAuthor 当前钱包是否为作者。
 * @param input.deleted 内容是否已删除。
 * @param input.newVersionBlockedReason 新版本创建受阻原因。
 * @param input.versionCount 当前版本数。
 * @param input.maxVersionsPerContent 最大允许版本数。
 * @returns 适合详情页状态摘要区展示的卡片数组。
 */
export function buildContentStatusSummary(input: {
  isAuthor: boolean;
  deleted: boolean;
  newVersionBlockedReason: string | null;
  versionCount: bigint;
  maxVersionsPerContent?: bigint;
}) {
  const {
    isAuthor,
    deleted,
    newVersionBlockedReason,
    versionCount,
    maxVersionsPerContent,
  } = input;

  const remainingVersionSlots =
    maxVersionsPerContent !== undefined
      ? Math.max(Number(maxVersionsPerContent - versionCount), 0)
      : null;

  return [
    {
      label: CONTENT_DETAIL_COPY.statusSummaryAuthor,
      value: isAuthor
        ? CONTENT_DETAIL_COPY.statusSummaryAuthorEditable
        : CONTENT_DETAIL_COPY.statusSummaryAuthorReadonly,
      description: isAuthor
        ? CONTENT_DETAIL_COPY.statusSummaryAuthorEditableDesc
        : CONTENT_DETAIL_COPY.statusSummaryAuthorReadonlyDesc,
    },
    {
      label: CONTENT_DETAIL_COPY.statusSummaryContentState,
      value: deleted
        ? CONTENT_DETAIL_COPY.statusDeleted
        : CONTENT_DETAIL_COPY.statusNormal,
      description: deleted
        ? CONTENT_DETAIL_COPY.statusSummaryDeletedDesc
        : CONTENT_DETAIL_COPY.statusSummaryActiveDesc,
    },
    {
      label: CONTENT_DETAIL_COPY.statusSummaryEditability,
      value: newVersionBlockedReason
        ? CONTENT_DETAIL_COPY.statusSummaryVersionBlocked
        : CONTENT_DETAIL_COPY.statusSummaryVersionAllowed,
      description:
        newVersionBlockedReason ?? CONTENT_DETAIL_COPY.statusSummaryVersionAllowedDesc,
    },
    {
      label: CONTENT_DETAIL_COPY.statusSummaryVersionBudget,
      value:
        remainingVersionSlots === null
          ? `${versionCount.toString()} 个已用版本`
          : `剩余 ${remainingVersionSlots} / ${maxVersionsPerContent?.toString()}`,
      description:
        remainingVersionSlots === null
          ? CONTENT_DETAIL_COPY.statusSummaryNoLimit
          : CONTENT_DETAIL_COPY.statusSummaryVersionUsed.replace(
              "{count}",
              versionCount.toString()
            ),
    },
  ] as const;
}
