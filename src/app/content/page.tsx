"use client";

/**
 * @file 内容广场模块。
 * @description 负责内容列表重建，以及“一键上传到 IPFS 并自动登记到链上”的发布流程。
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

type UploadedPublishAsset = {
  uploadId: number;
  cid: string;
  url: string;
};

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
  const [lastPublishedCid, setLastPublishedCid] = useState("");
  const [lastPublishedUrl, setLastPublishedUrl] = useState("");
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
   * 上传文件到本地 IPFS，并返回这次上传的记录信息。
   * @returns 成功时返回上传记录 ID、CID 与网关地址；失败时抛出异常。
   */
  const uploadContentAsset = useCallback(async () => {
    if (!file) {
      throw new Error(CONTENT_PAGE_COPY.selectFileFirst);
    }

    const formData = new FormData();
    formData.append("file", file);

    return txToast(
      (async () => {
        const response = await fetch("/api/ipfs/upload", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });

        const result = (await response.json()) as {
          uploadId?: number;
          cid?: string;
          url?: string;
          error?: string;
        };

        if (
          !response.ok ||
          typeof result.uploadId !== "number" ||
          !result.cid ||
          !result.url
        ) {
          throw new Error(result.error || CONTENT_PAGE_COPY.uploadFailed);
        }

        return {
          uploadId: result.uploadId,
          cid: result.cid,
          url: result.url,
        } satisfies UploadedPublishAsset;
      })(),
      CONTENT_PAGE_COPY.uploadLoading,
      CONTENT_PAGE_COPY.uploadSuccess,
      CONTENT_PAGE_COPY.uploadFailed
    );
  }, [file]);

  /**
   * 在链上登记成功后回写上传记录状态。
   * @param uploadId 上传记录 ID。
   * @param txHash 对应的链上交易哈希。
   */
  const markUploadRegistered = useCallback(
    async (
      uploadId: number,
      txHash: `0x${string}`,
      kind: "register" | "update"
    ) => {
      const response = await fetch("/api/ipfs/register-complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          uploadId,
          txHash,
          kind,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Failed to mark upload as registered");
      }
    },
    []
  );

  /**
   * 在发布流程失败时请求服务端立即回收刚刚上传的孤儿文件。
   * @param uploadId 上传记录 ID。
   * @param reason 清理原因。
   */
  const cleanupFailedUpload = useCallback(
    async (uploadId: number, reason: string) => {
      try {
        const response = await fetch("/api/ipfs/cleanup-orphan", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            uploadId,
            reason,
          }),
        });

        const result = (await response.json()) as {
          ok?: boolean;
          error?: string;
        };

        if (!response.ok || result.ok === false) {
          throw new Error(result.error || "Failed to clean orphan upload");
        }
      } catch (error) {
        reportContentPageError("Failed to clean orphan upload", error, {
          uploadId,
          reason,
        });
        toast.error(CONTENT_PAGE_COPY.orphanCleanupFailed);
      }
    },
    []
  );

  /**
   * 执行一键发布：上传到本地 IPFS 后自动调用 `registerContent`。
   * @returns 成功时清空表单并刷新列表；失败时尝试清理孤儿文件。
   */
  async function handlePublishContent() {
    if (!address) {
      toast.error(CONTENT_PAGE_COPY.connectWalletFirst);
      return;
    }

    if (!file) {
      toast.error(CONTENT_PAGE_COPY.selectFileFirst);
      return;
    }

    const uploadValidation = validateUploadFile(file);
    if (!uploadValidation.ok) {
      toast.error(uploadValidation.error);
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

    const isAuthorized = await ensureUploadAuth();

    if (!isAuthorized) {
      return;
    }

    let uploadedAsset: UploadedPublishAsset | null = null;

    setUploading(true);

    try {
      uploadedAsset = await uploadContentAsset();
      setLastPublishedCid(uploadedAsset.cid);
      setLastPublishedUrl(uploadedAsset.url);
    } catch (error) {
      reportContentPageError("Failed to upload content to IPFS", error, {
        fileName: file.name,
      });
      return;
    } finally {
      setUploading(false);
    }

    setRegistering(true);
    let chainRegistered = false;

    try {
      const hash = await writeTxToast({
        publicClient,
        writeContractAsync,
        request: {
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "registerContent",
          args: [uploadedAsset.cid, title.trim(), desc.trim()],
          value: typeof registerFee === "bigint" ? registerFee : 0n,
          account: address,
        },
        loading: CONTENT_PAGE_COPY.registerLoading,
        success: CONTENT_PAGE_COPY.registerSuccess,
        fail: CONTENT_PAGE_COPY.registerFailed,
      });

      if (!hash) {
        await cleanupFailedUpload(
          uploadedAsset.uploadId,
          "register_submission_failed"
        );
        return;
      }

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status !== "success") {
          throw new Error("registerContent transaction reverted");
        }
      }
      chainRegistered = true;

      try {
        await markUploadRegistered(uploadedAsset.uploadId, hash, "register");
      } catch (error) {
        reportContentPageError("Failed to mark upload as registered", error, {
          uploadId: uploadedAsset.uploadId,
          cid: uploadedAsset.cid,
          txHash: hash,
        });
        toast.warning(CONTENT_PAGE_COPY.registerTrackingWarning);
      }

      setFile(null);
      setTitle("");
      setDesc("");

      await refreshAfterTx(hash, refreshContentList, ["content", "dashboard"]);
    } catch (error) {
      reportContentPageError("Failed to publish content", error, {
        uploadId: uploadedAsset.uploadId,
        cid: uploadedAsset.cid,
      });
      if (!chainRegistered) {
        await cleanupFailedUpload(
          uploadedAsset.uploadId,
          "register_confirmation_failed"
        );
      }
    } finally {
      setRegistering(false);
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
          lastPublishedCid={lastPublishedCid}
          lastPublishedUrl={lastPublishedUrl}
          uploading={uploading}
          registering={registering}
          isAuthenticating={isAuthenticating}
          registerFee={typeof registerFee === "bigint" ? registerFee : undefined}
          uploadMaxFileSizeText={uploadMaxFileSizeText}
          onTitleChange={setTitle}
          onDescriptionChange={setDesc}
          onFileChange={handleFileChange}
          onPublish={handlePublishContent}
        />
      </div>
    </main>
  );
}
