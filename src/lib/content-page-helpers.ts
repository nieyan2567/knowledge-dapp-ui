/**
 * @notice Content 页面展示与列表辅助工具。
 * @dev 定义内容页文案、列表过滤排序分页逻辑以及上传策略展示格式化函数。
 */
import type { ContentCardData, ContentData } from "@/types/content";

/**
 * @notice 内容列表链上抓取分块大小。
 * @dev 用于分页读取内容合约时减少单次批量读取压力。
 */
export const CONTENT_FETCH_CHUNK_SIZE = 20;
/**
 * @notice 内容页默认每页展示数量。
 * @dev 该值用于前端分页切片。
 */
export const CONTENTS_PER_PAGE = 8;

/**
 * @notice Content 页面静态文案集合。
 * @dev 供内容列表、上传表单和分页区域复用。
 */
export const CONTENT_PAGE_COPY = {
  loadListFailed: "加载内容列表失败",
  selectFileFirst: "请先选择文件",
  uploadFailed: "文件上传失败",
  uploadLoading: "正在上传文件到 IPFS...",
  uploadSuccess: "文件上传成功",
  connectWalletFirst: "请先连接钱包",
  uploadToIpfsFirst: "请先上传文件到 IPFS",
  titleRequired: "请输入内容标题",
  registerFeeLoading: "发布费用尚未加载完成",
  registerLoading: "正在提交链上登记交易...",
  registerSuccess: "链上登记交易已提交",
  registerFailed: "链上登记失败",
  headerEyebrow: "Content Registry / Local IPFS",
  headerTitle: "Content Hub",
  headerDescription:
    "先完成钱包身份验证，再上传文件到本地 IPFS，最后将 CID 和元数据登记到链上。",
  listTitle: "内容列表",
  searchPlaceholder: "搜索标题、描述或 CID...",
  scopeAll: "全部内容",
  scopeMine: "我的内容",
  sortUpdated: "按最近更新",
  sortCreated: "按创建时间",
  sortVotes: "按投票数",
  sortVersions: "按版本数",
  loadingList: "正在加载内容列表...",
  emptyList: "暂无匹配内容，请先上传并登记第一条内容。",
  prevPage: "上一页",
  nextPage: "下一页",
  uploadTitle: "上传内容",
  uploadDescription:
    "首次上传会要求钱包签名完成身份验证，验证成功后才会调用 IPFS 上传接口。",
  titlePlaceholder: "内容标题",
  descriptionPlaceholder: "内容描述",
  uploadPolicyDescription:
    "单文件大小上限：{maxSize}。当前默认拒绝高风险格式，例如 HTML、JS、SVG、EXE、BAT、PS1、SH 等文件。服务端会重新识别文件真实类型，并对文本内容做风险扫描。",
  registerFeeTitle: "发布费用",
  freeNow: "当前免费",
  loadingFee: "正在读取费用...",
  registerFeeDescription:
    "链上登记时会把这笔费用转入协议金库，用于形成内容发布的消耗口。",
  authenticating: "正在验证身份...",
  uploading: "正在上传...",
  uploadToLocalIpfs: "上传到本地 IPFS",
  localGatewayUrl: "本地网关 URL",
  registering: "正在登记...",
  registerOnchain: "链上登记",
  totalCountSummary: "共 {count} 条",
  paginationPageSummary: "第 {page} / {totalPages} 页",
  paginationPageSizeSummary: "每页 {pageSize} 条",
} as const;

/**
 * @notice 将链上内容读取结果转换为内容卡片数据。
 * @param results 合约返回的原始内容结果数组。
 * @param rewardAccrualCounts 各内容对应的奖励记账次数。
 * @param parseContent 原始值到 `ContentData` 的解析函数。
 * @returns 过滤掉无效项和已删除内容后的卡片数据列表。
 */
export function parseContentResults(
  results: readonly unknown[],
  rewardAccrualCounts: readonly bigint[],
  parseContent: (value: unknown) => ContentData | null | undefined
): ContentCardData[] {
  return results
    .map((item, index) => {
      const content = parseContent(item);

      if (!content || content.deleted) {
        return null;
      }

      return {
        ...content,
        rewardAccrualCount: rewardAccrualCounts[index] ?? 0n,
      };
    })
    .filter((item): item is ContentCardData => !!item)
    .reverse();
}

/**
 * @notice 根据范围和关键词过滤内容列表。
 * @param contentList 原始内容列表。
 * @param scope 当前查看范围，可选全部或仅我的内容。
 * @param address 当前钱包地址。
 * @param search 搜索关键词。
 * @returns 过滤后的内容列表。
 */
export function filterContentList(
  contentList: ContentCardData[],
  scope: "all" | "mine",
  address: string | undefined,
  search: string
) {
  const keyword = search.trim().toLowerCase();
  const normalizedAddress = address?.toLowerCase();

  return contentList.filter((item) => {
    if (
      scope === "mine" &&
      (!normalizedAddress || item.author.toLowerCase() !== normalizedAddress)
    ) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return (
      item.title.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword) ||
      item.ipfsHash.toLowerCase().includes(keyword)
    );
  });
}

/**
 * @notice 根据指定规则排序内容列表。
 * @param items 待排序的内容列表。
 * @param sortBy 排序规则。
 * @returns 排序后的新数组。
 */
export function sortContentList(
  items: ContentCardData[],
  sortBy: "updated_desc" | "created_desc" | "votes_desc" | "versions_desc"
) {
  const sorted = [...items];

  sorted.sort((left, right) => {
    switch (sortBy) {
      case "created_desc":
        return Number(right.timestamp - left.timestamp);
      case "votes_desc":
        return Number(right.voteCount - left.voteCount);
      case "versions_desc":
        return Number(right.latestVersion - left.latestVersion);
      case "updated_desc":
      default:
        return Number(right.lastUpdatedAt - left.lastUpdatedAt);
    }
  });

  return sorted;
}

/**
 * @notice 对内容列表执行分页切片。
 * @param items 待分页的内容列表。
 * @param page 当前页码，从 1 开始。
 * @param pageSize 每页数量。
 * @returns 当前页对应的内容切片。
 */
export function paginateContentList(
  items: ContentCardData[],
  page: number,
  pageSize: number
) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * @notice 生成上传策略说明文案。
 * @param maxSize 上传大小上限文本。
 * @returns 替换占位后的上传策略说明。
 */
export function formatUploadPolicyDescription(maxSize: string) {
  return CONTENT_PAGE_COPY.uploadPolicyDescription.replace("{maxSize}", maxSize);
}

/**
 * @notice 生成内容总数摘要。
 * @param count 内容总数。
 * @returns 替换占位后的内容总数字符串。
 */
export function formatContentCountSummary(count: number) {
  return CONTENT_PAGE_COPY.totalCountSummary.replace("{count}", String(count));
}

/**
 * @notice 生成内容分页摘要。
 * @param page 当前页码。
 * @param totalPages 总页数。
 * @param pageSize 每页数量。
 * @returns 组合后的分页摘要文案。
 */
export function formatContentPaginationSummary(
  page: number,
  totalPages: number,
  pageSize: number
) {
  return `${CONTENT_PAGE_COPY.paginationPageSummary
    .replace("{page}", String(page))
    .replace("{totalPages}", String(totalPages))} ${CONTENT_PAGE_COPY.paginationPageSizeSummary.replace(
    "{pageSize}",
    String(pageSize)
  )}`;
}
