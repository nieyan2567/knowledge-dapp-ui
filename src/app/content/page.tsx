"use client";

/**
 * 模块说明：内容广场模块，负责内容列表重建、上传到 IPFS、以及内容注册到合约的前端流程。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { toast } from "sonner";

import {
  ContentListSection,
  ContentUploadSection,
} from "@/components/content/content-page-sections";
import { PageHeader } from "@/components/page-header";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useUploadAuth } from "@/hooks/useUploadAuth";
import {
  CONTENT_FETCH_CHUNK_SIZE,
  CONTENT_PAGE_COPY,
  CONTENTS_PER_PAGE,
  filterContentList,
  paginateContentList,
  parseContentResults,
  sortContentList,
} from "@/lib/content-page-helpers";
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

type ContentSortKey =
  | "updated_desc"
  | "created_desc"
  | "votes_desc"
  | "versions_desc";

/**
 * 上报内容广场页面中的可恢复错误。
 * @param message 错误摘要信息。
 * @param error 原始错误对象或失败载荷。
 * @param context 可选的结构化上下文信息。
 */
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

/**
 * 渲染内容广场页面。
 * @returns 包含内容发布表单和内容列表的页面。
 */
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

  /*
   * 内容列表不是后端直接返回的，而是前端按块读取合约中的 content 记录，
   * 再把奖励累计次数等补充字段一起拼成页面可直接使用的列表项。
   */
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

        const parsedChunk = parseContentResults(
          chunkResults,
          rewardAccrualCounts,
          asContentData
        );
        parsedContents.push(...parsedChunk);
      }

      return parsedContents;
    },
    [publicClient]
  );

  /*
   * 手动刷新会优先重新读取最新 contentCount，再据此重建整份列表，
   * 这样可以避免前端只刷新局部状态导致列表和链上真实数据不同步。
   */
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
      toast.error(CONTENT_PAGE_COPY.loadListFailed);
    } finally {
      setLoadingList(false);
    }
  }, [publicClient, readContents, refetchContentCount]);

  useEffect(() => {
    let cancelled = false;

    /*
     * 首次加载和 contentCount 变化时，页面会完整重建内容列表；
     * 这里用 cancelled 标记防止异步返回顺序晚于组件卸载。
     */
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
          toast.error(CONTENT_PAGE_COPY.loadListFailed);
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
    return filterContentList(contentList, scope, address, search);
  }, [address, contentList, scope, search]);

  const sortedContents = useMemo(() => {
    return sortContentList(filteredContents, sortBy);
  }, [filteredContents, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedContents.length / CONTENTS_PER_PAGE));
  const pagedContents = useMemo(() => {
    return paginateContentList(sortedContents, page, CONTENTS_PER_PAGE);
  }, [page, sortedContents]);

  useEffect(() => {
    setPage(1);
  }, [scope, search, sortBy]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  /**
   * 把用户选择的文件上传到 IPFS。
   * @returns 成功时写入 CID 和网关地址，失败时仅弹出错误提示。
   */
  async function handleUploadToIpfs() {
    if (!file) {
      toast.error(CONTENT_PAGE_COPY.selectFileFirst);
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
            throw new Error(result.error || CONTENT_PAGE_COPY.uploadFailed);
          }

          return {
            cid: result.cid,
            url: result.url,
          };
        })(),
        CONTENT_PAGE_COPY.uploadLoading,
        CONTENT_PAGE_COPY.uploadSuccess,
        CONTENT_PAGE_COPY.uploadFailed
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
      toast.error(CONTENT_PAGE_COPY.connectWalletFirst);
      return;
    }

    if (!uploadedCid) {
      toast.error(CONTENT_PAGE_COPY.uploadToIpfsFirst);
      return;
    }

    if (!title.trim()) {
      toast.error(CONTENT_PAGE_COPY.titleRequired);
      return;
    }

    if (registerFee === undefined) {
      toast.error(CONTENT_PAGE_COPY.registerFeeLoading);
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
        loading: CONTENT_PAGE_COPY.registerLoading,
        success: CONTENT_PAGE_COPY.registerSuccess,
        fail: CONTENT_PAGE_COPY.registerFailed,
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
        eyebrow={CONTENT_PAGE_COPY.headerEyebrow}
        title={CONTENT_PAGE_COPY.headerTitle}
        description={CONTENT_PAGE_COPY.headerDescription}
        testId={PAGE_TEST_IDS.content}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <ContentListSection
          search={search}
          scope={scope}
          sortBy={sortBy}
          page={page}
          totalPages={totalPages}
          loadingList={loadingList}
          sortedContentsLength={sortedContents.length}
          pagedContents={pagedContents}
          onSearchChange={setSearch}
          onScopeChange={setScope}
          onSortChange={setSortBy}
          onPrevPage={() => setPage((current) => Math.max(1, current - 1))}
          onNextPage={() => setPage((current) => Math.min(totalPages, current + 1))}
          onActionComplete={refreshContentList}
        />

        <ContentUploadSection
          title={title}
          desc={desc}
          file={file}
          uploadedCid={uploadedCid}
          uploadedUrl={uploadedUrl}
          uploading={uploading}
          registering={registering}
          isAuthenticating={isAuthenticating}
          registerFee={typeof registerFee === "bigint" ? registerFee : undefined}
          uploadMaxFileSizeText={uploadMaxFileSizeText}
          onTitleChange={setTitle}
          onDescriptionChange={setDesc}
          onFileChange={handleFileChange}
          onUpload={handleUploadToIpfs}
          onRegister={handleRegisterContent}
        />
      </div>
    </main>
  );
}
