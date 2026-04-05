"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { toast } from "sonner";

import { ContentCard } from "@/components/content-card";
import { CopyField } from "@/components/copy-field";
import { FileDrop } from "@/components/file-drop";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useUploadAuth } from "@/hooks/useUploadAuth";
import { BRANDING } from "@/lib/branding";
import { reportClientError } from "@/lib/observability/client";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import { txToast, writeTxToast } from "@/lib/tx-toast";
import {
  formatUploadFileSize,
  getUploadMaxFileSizeBytes,
  validateUploadFile,
} from "@/lib/upload-policy";
import { asContentData } from "@/lib/web3-types";
import type { ContentCardData } from "@/types/content";

const CONTENT_FETCH_CHUNK_SIZE = 20;
const CONTENTS_PER_PAGE = 8;

type ContentSortKey =
  | "updated_desc"
  | "created_desc"
  | "votes_desc"
  | "versions_desc";

function parseContentResults(
  results: readonly unknown[],
  rewardAccrualCounts: readonly bigint[]
): ContentCardData[] {
  return results
    .map((item, index) => {
      const content = asContentData(item);

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

function reportContentPageError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  void reportClientError({
    message,
    source: "content.page",
    severity: "error",
    handled: true,
    error,
    context,
  });
}

export default function ContentPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const refreshAfterTx = useRefreshOnTxConfirmed();
  const { ensureUploadAuth, isAuthenticating } = useUploadAuth();

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadedCid, setUploadedCid] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [sortBy, setSortBy] = useState<ContentSortKey>("updated_desc");
  const [page, setPage] = useState(1);
  const [contentList, setContentList] = useState<ContentCardData[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const uploadMaxFileSizeText = useMemo(
    () => formatUploadFileSize(getUploadMaxFileSizeBytes()),
    []
  );

  const { data: contentCount, refetch: refetchContentCount } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "contentCount",
  });

  const { data: registerFee } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "registerFee",
  });

  const readContents = useCallback(
    async (total: number) => {
      if (!publicClient || total <= 0) {
        return [];
      }

      const ids = Array.from({ length: total }, (_, index) => BigInt(index + 1));
      const parsedContents: ContentCardData[] = [];

      for (let start = 0; start < ids.length; start += CONTENT_FETCH_CHUNK_SIZE) {
        const chunk = ids.slice(start, start + CONTENT_FETCH_CHUNK_SIZE);
        const chunkResults = await Promise.all(
          chunk.map((id) =>
            publicClient.readContract({
              address: CONTRACTS.KnowledgeContent as `0x${string}`,
              abi: ABIS.KnowledgeContent,
              functionName: "contents",
              args: [id],
            })
          )
        );
        const rewardAccrualCounts = (await Promise.all(
          chunk.map((id) =>
            publicClient.readContract({
              address: CONTRACTS.KnowledgeContent as `0x${string}`,
              abi: ABIS.KnowledgeContent,
              functionName: "rewardAccrualCount",
              args: [id],
            })
          )
        )) as bigint[];

        const parsedChunk = parseContentResults(chunkResults, rewardAccrualCounts);
        parsedContents.push(...parsedChunk);
      }

      return parsedContents;
    },
    [publicClient]
  );

  const refreshContentList = useCallback(async () => {
    if (!publicClient) {
      setContentList([]);
      return;
    }

    setLoadingList(true);

    try {
      const latestCount = Number((await refetchContentCount()).data ?? 0n);
      const parsed = await readContents(latestCount);
      setContentList(parsed);
    } catch (error) {
      reportContentPageError("Failed to refresh content list", error);
      toast.error("鍔犺浇鍐呭鍒楄〃澶辫触");
    } finally {
      setLoadingList(false);
    }
  }, [publicClient, readContents, refetchContentCount]);

  useEffect(() => {
    let cancelled = false;

    async function loadContents() {
      if (!publicClient || contentCount === undefined) {
        setContentList([]);
        return;
      }

      setLoadingList(true);

      try {
        const parsed = await readContents(Number(contentCount));

        if (!cancelled) {
          setContentList(parsed);
        }
      } catch (error) {
        reportContentPageError("Failed to load content list", error);
        if (!cancelled) {
          toast.error("鍔犺浇鍐呭鍒楄〃澶辫触");
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    }

    void loadContents();

    return () => {
      cancelled = true;
    };
  }, [contentCount, publicClient, readContents]);

  const filteredContents = useMemo(() => {
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
  }, [address, contentList, scope, search]);

  const sortedContents = useMemo(() => {
    const items = [...filteredContents];

    items.sort((left, right) => {
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

    return items;
  }, [filteredContents, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedContents.length / CONTENTS_PER_PAGE));
  const pagedContents = useMemo(() => {
    const start = (page - 1) * CONTENTS_PER_PAGE;
    return sortedContents.slice(start, start + CONTENTS_PER_PAGE);
  }, [page, sortedContents]);

  useEffect(() => {
    setPage(1);
  }, [scope, search, sortBy]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function handleUploadToIpfs() {
    if (!file) {
      toast.error("璇峰厛閫夋嫨鏂囦欢");
      return;
    }

    const uploadValidation = validateUploadFile(file);
    if (!uploadValidation.ok) {
      toast.error(uploadValidation.error);
      return;
    }

    const isAuthorized = await ensureUploadAuth();

    if (!isAuthorized) {
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await txToast(
        (async () => {
          const response = await fetch("/api/ipfs/upload", {
            method: "POST",
            body: formData,
            credentials: "same-origin",
          });

          const result = (await response.json()) as {
            cid?: string;
            url?: string;
            error?: string;
          };

          if (!response.ok || !result.cid || !result.url) {
            throw new Error(result.error || "鏂囦欢涓婁紶澶辫触");
          }

          return {
            cid: result.cid,
            url: result.url,
          };
        })(),
        "姝ｅ湪涓婁紶鏂囦欢鍒?IPFS...",
        "鏂囦欢涓婁紶鎴愬姛",
        "鏂囦欢涓婁紶澶辫触"
      );

      setUploadedCid(data.cid);
      setUploadedUrl(data.url);
    } catch (error) {
      reportContentPageError("Failed to upload content to IPFS", error, {
        fileName: file.name,
      });
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(selectedFile: File) {
    const uploadValidation = validateUploadFile(selectedFile);

    if (!uploadValidation.ok) {
      toast.error(uploadValidation.error);
      return;
    }

    setFile(selectedFile);
  }

  async function handleRegisterContent() {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    if (!uploadedCid) {
      toast.error("请先上传文件到 IPFS");
      return;
    }

    if (!title.trim()) {
      toast.error("请输入内容标题");
      return;
    }

    if (registerFee === undefined) {
      toast.error("发布费用尚未加载完成");
      return;
    }

    setRegistering(true);

    try {
      const hash = await writeTxToast({
        publicClient,
        writeContractAsync,
        request: {
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "registerContent",
          args: [uploadedCid, title.trim(), desc.trim()],
          value: typeof registerFee === "bigint" ? registerFee : 0n,
          account: address,
        },
        loading: "正在提交链上登记交易...",
        success: "链上登记交易已提交",
        fail: "链上登记失败",
      });

      if (!hash) {
        return;
      }

      setFile(null);
      setUploadedCid("");
      setUploadedUrl("");
      setTitle("");
      setDesc("");

      await refreshAfterTx(hash, refreshContentList, ["content", "dashboard"]);
    } catch (error) {
      reportContentPageError("Failed to register content on-chain", error, {
        cid: uploadedCid,
      });
    } finally {
      setRegistering(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Content Registry · Local IPFS"
        title="Content Hub"
        description="先完成钱包身份验证，再上传文件到本地 IPFS，最后将 CID 和元数据登记到链上。"
        testId={PAGE_TEST_IDS.content}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
              内容列表
            </h2>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              共 {sortedContents.length} 条
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
            <input
              placeholder="搜索标题、描述或 CID..."
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as "all" | "mine")}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400"
            >
              <option value="all">全部内容</option>
              <option value="mine">我的内容</option>
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as ContentSortKey)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400"
            >
              <option value="updated_desc">按最近更新</option>
              <option value="created_desc">按创建时间</option>
              <option value="votes_desc">按投票数</option>
              <option value="versions_desc">按版本数</option>
            </select>
          </div>

          {loadingList ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              正在加载内容列表...
            </div>
          ) : sortedContents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              暂无匹配内容，请先上传并登记第一条内容。
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {pagedContents.map((item) => (
                  <ContentCard
                    key={item.id.toString()}
                    content={item}
                    onActionComplete={refreshContentList}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  第 {page} / {totalPages} 页
                  <span className="ml-2 text-slate-500 dark:text-slate-400">
                    每页 {CONTENTS_PER_PAGE} 条
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <SectionCard
            title="上传内容"
            description="首次上传会要求钱包签名完成身份验证，验证成功后才会调用 IPFS 上传接口。"
          >
            <div className="space-y-4">
              <input
                placeholder="内容标题"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
              />

              <textarea
                placeholder="内容描述"
                value={desc}
                onChange={(event) => setDesc(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
              />

              <FileDrop file={file} onChange={handleFileChange} />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                单文件大小上限：{uploadMaxFileSizeText}。当前默认拒绝高风险格式，例如
                HTML、JS、SVG、EXE、BAT、PS1、SH 等文件。服务端会重新识别文件真实类型，
                并对文本内容做风险扫描。
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  发布费用
                </div>
                <div className="mt-1">
                  {typeof registerFee === "bigint"
                    ? registerFee > 0n
                      ? `${formatEther(registerFee)} ${BRANDING.nativeTokenSymbol}`
                      : "当前免费"
                    : "正在读取费用..."}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  链上登记时会把这笔费用转入协议金库，用于形成内容发布的消耗口。
                </div>
              </div>

              <button
                onClick={handleUploadToIpfs}
                disabled={!file || uploading || isAuthenticating}
                className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {isAuthenticating
                  ? "正在验证身份..."
                  : uploading
                    ? "正在上传..."
                    : "上传到本地 IPFS"}
              </button>

              {uploadedCid && (
                <div className="space-y-3">
                  <CopyField label="CID" value={uploadedCid} />
                  <CopyField label="本地网关 URL" value={uploadedUrl} />
                </div>
              )}

              <button
                onClick={handleRegisterContent}
                disabled={!uploadedCid || registering || registerFee === undefined}
                className="w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {registering ? "正在登记..." : "链上登记"}
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}

