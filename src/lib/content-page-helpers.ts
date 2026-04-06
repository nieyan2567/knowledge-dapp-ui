import type { ContentCardData, ContentData } from "@/types/content";

export const CONTENT_FETCH_CHUNK_SIZE = 20;
export const CONTENTS_PER_PAGE = 8;

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

export function paginateContentList(
  items: ContentCardData[],
  page: number,
  pageSize: number
) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function formatUploadPolicyDescription(maxSize: string) {
  return CONTENT_PAGE_COPY.uploadPolicyDescription.replace("{maxSize}", maxSize);
}

export function formatContentCountSummary(count: number) {
  return CONTENT_PAGE_COPY.totalCountSummary.replace("{count}", String(count));
}

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
