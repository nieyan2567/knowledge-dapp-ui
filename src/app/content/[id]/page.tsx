"use client";

/**
 * 模块说明：内容详情模块，负责单条内容的详情展示、版本历史、投票、奖励累计和作者侧编辑流程。
 */
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { ArrowLeft, ExternalLink } from "lucide-react";

import {
  ContentCurrentFileSection,
  ContentSnapshotGrid,
  ContentStatusSummaryGrid,
  ContentVersionHistoryList,
} from "@/components/content/content-detail-sections";
import {
  ContentActionsSection,
  ContentEditSection,
} from "@/components/content/content-detail-side-sections";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useUploadAuth } from "@/hooks/useUploadAuth";
import {
  buildContentStatusSummary,
  CONTENT_DETAIL_COPY,
} from "@/lib/content-detail-helpers";
import { getIpfsFileUrl } from "@/lib/ipfs";
import { reportClientError } from "@/lib/observability/client";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import { txToast, writeTxToast } from "@/lib/tx-toast";
import {
  formatUploadFileSize,
  getUploadMaxFileSizeBytes,
  validateUploadFile,
} from "@/lib/upload-policy";
import { asContentData, asContentVersion } from "@/lib/web3-types";
import type { ContentVersionData } from "@/types/content";

type ContentStorageLifecycleSummary = {
  contentId: number;
  totalRecords: number;
  purgedCount: number;
  hasPendingPurge: boolean;
  scheduledAt: string | null;
  fullyPurged: boolean;
};

/**
 * 上报内容详情页中的可恢复错误。
 * @param message 错误摘要信息。
 * @param error 原始错误对象或下游返回载荷。
 * @param context 可选的结构化上下文信息。
 */
function reportContentDetailError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  void reportClientError({
    message,
    source: "content.detail",
    severity: "error",
    handled: true,
    error,
    context,
  });
}

/**
 * 渲染单条内容的详情页。
 * @returns 当前内容的详情、版本和操作页面。
 */
export default function ContentDetailPage() {
  const params = useParams();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const refreshAfterTx = useRefreshOnTxConfirmed();
  const { ensureUploadAuth, isAuthenticating } = useUploadAuth();

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCid, setEditCid] = useState("");
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [uploadedVersionUploadId, setUploadedVersionUploadId] = useState<number | null>(null);
  const [uploadedVersionUrl, setUploadedVersionUrl] = useState("");
  const [uploadingVersionFile, setUploadingVersionFile] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versions, setVersions] = useState<ContentVersionData[]>([]);
  const [contentLifecycleSummary, setContentLifecycleSummary] =
    useState<ContentStorageLifecycleSummary | null>(null);

  const rawId = params?.id;
  const contentId = useMemo(() => {
    if (typeof rawId !== "string") return null;
    if (!/^\d+$/.test(rawId)) return null;
    return BigInt(rawId);
  }, [rawId]);

  const uploadMaxFileSizeText = useMemo(
    () => formatUploadFileSize(getUploadMaxFileSizeBytes()),
    []
  );

  const {
    data: contentData,
    isLoading,
    refetch: refetchContent,
  } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "contents",
    args: contentId ? [contentId] : undefined,
    query: {
      enabled: !!contentId,
    },
  });

  const {
    data: versionCountData,
    refetch: refetchVersionCount,
  } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "contentVersionCount",
    args: contentId ? [contentId] : undefined,
    query: {
      enabled: !!contentId,
    },
  });

  const { data: rewardAccrualCountData } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "rewardAccrualCount",
    args: contentId ? [contentId] : undefined,
    query: {
      enabled: !!contentId,
    },
  });

  const { data: maxVersionsPerContentData } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "maxVersionsPerContent",
  });

  const { data: editLockVotesData } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "editLockVotes",
  });

  const { data: allowDeleteAfterVoteData } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "allowDeleteAfterVote",
  });

  const { data: updateFeeData } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "updateFee",
  });

  const content = asContentData(contentData);
  const versionCount = typeof versionCountData === "bigint" ? versionCountData : 0n;
  const rewardAccrualCount =
    typeof rewardAccrualCountData === "bigint" ? rewardAccrualCountData : 0n;
  const maxVersionsPerContent =
    typeof maxVersionsPerContentData === "bigint" ? maxVersionsPerContentData : undefined;
  const editLockVotes =
    typeof editLockVotesData === "bigint" ? editLockVotesData : undefined;
  const allowDeleteAfterVote =
    typeof allowDeleteAfterVoteData === "boolean" ? allowDeleteAfterVoteData : undefined;
  const updateFee = typeof updateFeeData === "bigint" ? updateFeeData : undefined;

  /*
   * 版本历史不是一次性嵌在 content 结构里的，需要根据 versionCount
   * 逐条回读 getContentVersion，再在前端倒序整理成历史列表。
   */
  const loadVersions = useCallback(
    async (countOverride?: bigint) => {
      if (!publicClient || !contentId) {
        setVersions([]);
        return;
      }

      const total = Number(countOverride ?? versionCount);

      if (total <= 0) {
        setVersions([]);
        return;
      }

      setLoadingVersions(true);

      try {
        const versionIds = Array.from({ length: total }, (_, index) => BigInt(index + 1));
        const results = await Promise.all(
          versionIds.map((version) =>
            publicClient.readContract({
              address: CONTRACTS.KnowledgeContent as `0x${string}`,
              abi: ABIS.KnowledgeContent,
              functionName: "getContentVersion",
              args: [contentId, version],
            })
          )
        );

        const parsed = results
          .map((item, index) => asContentVersion(item, versionIds[index]))
          .filter((item): item is ContentVersionData => !!item)
          .sort((left, right) => Number(right.version - left.version));

        setVersions(parsed);
      } catch (error) {
        reportContentDetailError("Failed to load content version history", error, {
          contentId: contentId.toString(),
        });
        toast.error(CONTENT_DETAIL_COPY.loadVersionsFailed);
      } finally {
        setLoadingVersions(false);
      }
    },
    [contentId, publicClient, versionCount]
  );

  /**
   * 拉取当前内容对应的链下文件生命周期状态。
   * @returns 完整摘要；若尚未建立记录则返回 null。
   */
  const loadContentLifecycleSummary = useCallback(async () => {
    if (!contentId) {
      setContentLifecycleSummary(null);
      return null;
    }

    try {
      const response = await fetch(
        `/api/ipfs/content-lifecycle?contentId=${contentId.toString()}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      const result = (await response.json()) as {
        summary?: ContentStorageLifecycleSummary | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Failed to load content lifecycle summary");
      }

      setContentLifecycleSummary(result.summary ?? null);
      return result.summary ?? null;
    } catch (error) {
      reportContentDetailError("Failed to load content lifecycle summary", error, {
        contentId: contentId.toString(),
      });
      return null;
    }
  }, [contentId]);

  /*
   * 详情刷新同时依赖内容主体和版本数量两个来源，因此这里先并行刷新链上读值，
   * 再把最新的版本数量传给版本加载逻辑，避免使用旧的 versionCount。
   */
  const refreshDetail = useCallback(async () => {
    const [, versionResult] = await Promise.all([refetchContent(), refetchVersionCount()]);
    await loadVersions(
      typeof versionResult.data === "bigint" ? versionResult.data : undefined
    );
    await loadContentLifecycleSummary();
  }, [loadContentLifecycleSummary, loadVersions, refetchContent, refetchVersionCount]);

  const currentContentId = content?.id;
  const currentContentTitle = content?.title;
  const currentContentDescription = content?.description;
  const currentContentCid = content?.ipfsHash;
  const currentContentLatestVersion = content?.latestVersion;
  const currentContentDeleted = content?.deleted;

  useEffect(() => {
    // 当链上内容主体变化后，把当前编辑表单同步到最新内容快照。
    if (!currentContentTitle || currentContentDescription === undefined || !currentContentCid) {
      return;
    }

    setEditTitle(currentContentTitle);
    setEditDescription(currentContentDescription);
    setEditCid(currentContentCid);
    setVersionFile(null);
    setUploadedVersionUploadId(null);
    setUploadedVersionUrl("");
  }, [
    currentContentCid,
    currentContentDescription,
    currentContentDeleted,
    currentContentId,
    currentContentLatestVersion,
    currentContentTitle,
  ]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  useEffect(() => {
    void loadContentLifecycleSummary();
  }, [loadContentLifecycleSummary]);

  /**
   * 复制指定字段到剪贴板。
   * @param value 需要复制的文本内容。
   * @param label 用于提示文案的字段名称。
   * @returns 成功时提示复制成功，失败时上报错误并提示失败。
   */
  const handleCopyToClipboard = useCallback(
    async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value);
        toast.success(`${label}已复制`);
      } catch (error) {
        reportContentDetailError("Failed to copy content detail field", error, {
          contentId: contentId?.toString() ?? "unknown",
          label,
        });
        toast.error(`复制${label}失败`);
      }
    },
    [contentId]
  );

  function handleVersionFileChange(selectedFile: File) {
    const uploadValidation = validateUploadFile(selectedFile);

    if (!uploadValidation.ok) {
      toast.error(uploadValidation.error);
      return;
    }

    setVersionFile(selectedFile);
  }

  /**
   * 在链上更新成功后，把本次版本文件上传记录绑定到具体内容版本。
   * @param uploadId 上传记录 ID。
   * @param txHash 更新交易哈希。
   * @returns 服务端确认后返回，否则抛错。
   */
  const markVersionUploadRegistered = useCallback(
    async (uploadId: number, txHash: `0x${string}`) => {
      const response = await fetch("/api/ipfs/register-complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          uploadId,
          txHash,
          kind: "update",
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Failed to bind uploaded version to content");
      }
    },
    []
  );

  /**
   * 在版本更新最终失败后，回滚刚上传但未登记的新版本文件。
   * @param uploadId 上传记录 ID。
   * @param reason 清理原因。
   * @returns 请求完成后结束；失败时仅提示，不阻断页面。
   */
  const cleanupFailedVersionUpload = useCallback(
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
          throw new Error(result.error || "Failed to clean uploaded version asset");
        }
      } catch (error) {
        reportContentDetailError("Failed to clean orphan version upload", error, {
          uploadId,
          reason,
        });
        toast.error("新版本文件回收失败，请稍后通过系统清理任务处理。");
      }
    },
    []
  );

  /**
   * 同步链上删除/恢复结果到链下文件生命周期表。
   * @param action 当前内容生命周期动作。
   * @param txHash 对应的成功交易哈希。
   * @returns 成功时结束；失败时抛错，由调用方决定是否仅提示。
   */
  const syncContentLifecycleAction = useCallback(
    async (action: "delete" | "restore", txHash: `0x${string}`) => {
      const response = await fetch("/api/ipfs/content-lifecycle", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          contentId: Number(contentId),
          txHash,
          action,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Failed to sync content storage lifecycle");
      }
    },
    [contentId]
  );

  if (!contentId) {
    notFound();
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          {CONTENT_DETAIL_COPY.loadingDetail}
        </div>
      </main>
    );
  }

  if (!content) {
    return (
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-10">
        <Link
          href="/content"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {CONTENT_DETAIL_COPY.backToList}
        </Link>

        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {CONTENT_DETAIL_COPY.notFound}
        </div>
      </main>
    );
  }

  const contentRecord = content;
  const previewUrl = getIpfsFileUrl(contentRecord.ipfsHash);
  const isAuthor =
    !!address && contentRecord.author.toLowerCase() === address.toLowerCase();
  const contentFilesFullyPurged = contentLifecycleSummary?.fullyPurged ?? false;
  const isEditLocked =
    editLockVotes !== undefined &&
    editLockVotes > 0n &&
    contentRecord.voteCount >= editLockVotes;
  const hasReachedMaxVersions =
    maxVersionsPerContent !== undefined && versionCount >= maxVersionsPerContent;
  const canEditContent =
    isAuthor && !contentRecord.deleted && !hasReachedMaxVersions && !isEditLocked;
  const deleteBlockedByVotes =
    allowDeleteAfterVote === false && contentRecord.voteCount > 0n;
  const canDeleteContent = isAuthor && !contentRecord.deleted && !deleteBlockedByVotes;
  const canRestoreContent = isAuthor && contentRecord.deleted && !contentFilesFullyPurged;
  const newVersionBlockedReason = !isAuthor
    ? "只有内容作者可以创建新版本。"
    : contentRecord.deleted
      ? "内容已软删除，恢复后才能继续创建新版本。"
      : isEditLocked
        ? `当前内容票数已达到编辑锁定阈值（${contentRecord.voteCount.toString()} / ${editLockVotes?.toString() ?? "0"}），不能再创建新版本。`
      : hasReachedMaxVersions
        ? `已达到当前内容的最大版本数上限（${maxVersionsPerContent?.toString() ?? versionCount.toString()}）。`
        : null;
  const contentStatusSummary = buildContentStatusSummary({
    isAuthor,
    deleted: contentRecord.deleted,
    newVersionBlockedReason,
    versionCount,
    maxVersionsPerContent,
  });

  async function handleVote() {
    if (!address) {
      toast.error(CONTENT_DETAIL_COPY.connectWalletFirst);
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "vote",
        args: [contentRecord.id],
        account: address,
      },
      loading: CONTENT_DETAIL_COPY.voteLoading,
      success: CONTENT_DETAIL_COPY.voteSuccess,
      fail: CONTENT_DETAIL_COPY.voteFail,
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshDetail, ["content", "dashboard"]);
  }

  async function handleAccrueReward() {
    if (!address) {
      toast.error(CONTENT_DETAIL_COPY.connectWalletFirst);
      return;
    }

    if (!isAuthor) {
      toast.error(CONTENT_DETAIL_COPY.accrueRewardAuthorOnlyShort);
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "distributeReward",
        args: [contentRecord.id],
        account: address,
      },
      loading: CONTENT_DETAIL_COPY.accrueRewardLoading,
      success: CONTENT_DETAIL_COPY.accrueRewardSuccess,
      fail: CONTENT_DETAIL_COPY.accrueRewardFail,
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshDetail, ["content", "rewards", "dashboard", "system"]);
  }

  async function handleUpdateContent() {
    if (!address) {
      toast.error(CONTENT_DETAIL_COPY.connectWalletFirst);
      return;
    }

    if (newVersionBlockedReason) {
      toast.error(CONTENT_DETAIL_COPY.updateBlocked);
      return;
    }

    if (!editTitle.trim()) {
      toast.error(CONTENT_DETAIL_COPY.updateTitleRequired);
      return;
    }

    const hasVersionFile = !!versionFile;

    if (!hasVersionFile && !editCid.trim()) {
      toast.error(CONTENT_DETAIL_COPY.updateCidRequired);
      return;
    }

    if (updateFee === undefined) {
      toast.error(CONTENT_DETAIL_COPY.updateFeeLoading);
      return;
    }

    setSavingEdit(true);
    let versionRegistered = false;
    let uploadedAsset:
      | {
          uploadId: number;
          cid: string;
          url: string;
        }
      | null = null;

    try {
      let targetCid = editCid.trim();

      if (hasVersionFile) {
        const uploadValidation = validateUploadFile(versionFile);

        if (!uploadValidation.ok) {
          toast.error(uploadValidation.error);
          return;
        }

        const isAuthorized = await ensureUploadAuth();

        if (!isAuthorized) {
          return;
        }

        setUploadingVersionFile(true);

        try {
          const formData = new FormData();
          formData.append("file", versionFile);

          uploadedAsset = await txToast(
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
                throw new Error(result.error || CONTENT_DETAIL_COPY.uploadVersionFailed);
              }

              return {
                uploadId: result.uploadId,
                cid: result.cid,
                url: result.url,
              };
            })(),
            CONTENT_DETAIL_COPY.uploadVersionLoadingToast,
            CONTENT_DETAIL_COPY.uploadVersionSuccess,
            CONTENT_DETAIL_COPY.uploadVersionFailed
          );
        } catch (error) {
          reportContentDetailError("Failed to upload replacement content file", error, {
            contentId: contentRecord.id.toString(),
            fileName: versionFile.name,
          });
          return;
        } finally {
          setUploadingVersionFile(false);
        }

        targetCid = uploadedAsset.cid;
        setUploadedVersionUploadId(uploadedAsset.uploadId);
        setUploadedVersionUrl(uploadedAsset.url);
        setEditCid(uploadedAsset.cid);
      }

      const hash = await writeTxToast({
        publicClient,
        writeContractAsync,
        request: {
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "updateContent",
          args: [
            contentRecord.id,
            targetCid,
            editTitle.trim(),
            editDescription.trim(),
          ],
          value: updateFee ?? 0n,
          account: address,
        },
        loading: CONTENT_DETAIL_COPY.updateLoading,
        success: CONTENT_DETAIL_COPY.updateSuccess,
        fail: CONTENT_DETAIL_COPY.updateFail,
      });

      if (!hash) {
        if (uploadedAsset) {
          await cleanupFailedVersionUpload(
            uploadedAsset.uploadId,
            "content_update_submission_failed"
          );
        }
        return;
      }

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status !== "success") {
          throw new Error("updateContent transaction reverted");
        }
      }
      versionRegistered = true;

      if (uploadedAsset) {
        try {
          await markVersionUploadRegistered(uploadedAsset.uploadId, hash);
        } catch (error) {
          reportContentDetailError("Failed to bind uploaded version after update", error, {
            contentId: contentRecord.id.toString(),
            uploadId: uploadedAsset.uploadId,
            txHash: hash,
          });
          toast.warning("新版本链上已生效，但上传记录绑定失败，请稍后检查系统清理状态。");
        }
      }

      await refreshAfterTx(hash, refreshDetail, ["content", "dashboard"]);
      setVersionFile(null);
      setUploadedVersionUploadId(null);
      setUploadedVersionUrl("");
    } catch (error) {
      if (!versionRegistered && uploadedAsset) {
        await cleanupFailedVersionUpload(
          uploadedAsset.uploadId,
          "content_update_confirmation_failed"
        );
      }
    } finally {
      setUploadingVersionFile(false);
      setSavingEdit(false);
    }
  }

  async function handleDeleteContent() {
    if (!address) {
      toast.error(CONTENT_DETAIL_COPY.connectWalletFirst);
      return;
    }

    if (!canDeleteContent) {
      toast.error(CONTENT_DETAIL_COPY.deleteBlocked);
      return;
    }

    setDeleting(true);

    try {
      const hash = await writeTxToast({
        publicClient,
        writeContractAsync,
        request: {
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "deleteContent",
          args: [contentRecord.id],
          account: address,
        },
        loading: CONTENT_DETAIL_COPY.deleteLoading,
        success: CONTENT_DETAIL_COPY.deleteSuccess,
        fail: CONTENT_DETAIL_COPY.deleteFail,
      });

      if (!hash) return;
      await refreshAfterTx(hash, refreshDetail, ["content", "dashboard"]);
      try {
        await syncContentLifecycleAction("delete", hash);
        await loadContentLifecycleSummary();
      } catch (error) {
        reportContentDetailError("Failed to sync content soft delete lifecycle", error, {
          contentId: contentRecord.id.toString(),
          txHash: hash,
        });
        toast.warning("链上已删除成功，但延迟清理计划写入失败，请稍后重试或手动触发系统清理。");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleRestoreContent() {
    if (!address) {
      toast.error(CONTENT_DETAIL_COPY.connectWalletFirst);
      return;
    }

    if (!canRestoreContent) {
      toast.error(CONTENT_DETAIL_COPY.restoreBlocked);
      return;
    }

    setRestoring(true);

    try {
      const hash = await writeTxToast({
        publicClient,
        writeContractAsync,
        request: {
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "restoreContent",
          args: [contentRecord.id],
          account: address,
        },
        loading: CONTENT_DETAIL_COPY.restoreTxLoading,
        success: CONTENT_DETAIL_COPY.restoreTxSuccess,
        fail: CONTENT_DETAIL_COPY.restoreTxFail,
      });

      if (!hash) return;
      await refreshAfterTx(hash, refreshDetail, ["content", "dashboard"]);
      try {
        await syncContentLifecycleAction("restore", hash);
        await loadContentLifecycleSummary();
      } catch (error) {
        reportContentDetailError("Failed to cancel scheduled content cleanup", error, {
          contentId: contentRecord.id.toString(),
          txHash: hash,
        });
        toast.warning("链上已恢复成功，但链下清理计划取消失败，请稍后检查系统状态。");
      }
    } finally {
      setRestoring(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/content"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {CONTENT_DETAIL_COPY.backToList}
        </Link>

        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {CONTENT_DETAIL_COPY.previewCurrentFile}
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <PageHeader
        eyebrow={`内容 #${contentRecord.id.toString()}`}
        title={contentRecord.title}
        description={contentRecord.description || CONTENT_DETAIL_COPY.noDescription}
        testId={PAGE_TEST_IDS.content}
      />

      <ContentStatusSummaryGrid items={contentStatusSummary} />

      {contentRecord.deleted && contentLifecycleSummary?.hasPendingPurge ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          当前内容已进入延迟清理阶段，计划清理时间：
          {contentLifecycleSummary.scheduledAt
            ? ` ${new Date(contentLifecycleSummary.scheduledAt).toLocaleString("zh-CN", {
                hour12: false,
              })}`
            : " 待系统任务执行"}
          。在此之前恢复内容，可取消整条记录下所有版本文件的清理计划。
        </div>
      ) : null}

      {contentRecord.deleted && contentFilesFullyPurged ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-6 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          当前内容对应的版本文件已经完成物理清理，链上记录仍保留用于历史追踪，但文件本体已不可恢复，因此不再允许执行恢复操作。
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SectionCard
            title={CONTENT_DETAIL_COPY.currentFileTitle}
            description={CONTENT_DETAIL_COPY.currentFileDescription}
          >
            <ContentCurrentFileSection
              contentId={contentRecord.id}
              latestVersion={contentRecord.latestVersion}
              deleted={contentRecord.deleted}
              title={contentRecord.title}
              description={contentRecord.description}
              previewUrl={previewUrl}
              currentCid={content.ipfsHash}
            />
          </SectionCard>

          <SectionCard
            title={CONTENT_DETAIL_COPY.snapshotTitle}
            description={CONTENT_DETAIL_COPY.snapshotDescription}
          >
            <ContentSnapshotGrid
              author={contentRecord.author}
              createdAt={contentRecord.timestamp}
              latestVersion={contentRecord.latestVersion}
              versionCount={versionCount}
              lastUpdatedAt={contentRecord.lastUpdatedAt}
              voteCount={contentRecord.voteCount}
              rewardAccrualCount={rewardAccrualCount}
            />
          </SectionCard>

          <SectionCard
            title={CONTENT_DETAIL_COPY.versionHistoryTitle}
            description={CONTENT_DETAIL_COPY.versionHistoryDescription}
          >
            <ContentVersionHistoryList
              loadingVersions={loadingVersions}
              versions={versions}
              latestVersion={contentRecord.latestVersion}
              onCopyCid={handleCopyToClipboard}
            />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <ContentActionsSection
            deleted={contentRecord.deleted}
            isAuthor={isAuthor}
            canRestoreContent={canRestoreContent}
            restoring={restoring}
            onVote={handleVote}
            onAccrueReward={handleAccrueReward}
            onRestore={handleRestoreContent}
          />

          <ContentEditSection
            deleted={contentRecord.deleted}
            editTitle={editTitle}
            editDescription={editDescription}
            editCid={editCid}
            versionFile={versionFile}
            uploadedVersionUrl={uploadedVersionUrl}
            uploadingVersionFile={uploadingVersionFile}
            savingEdit={savingEdit}
            deleting={deleting}
            restoring={restoring}
            isAuthenticating={isAuthenticating}
            updateFee={updateFee}
            uploadMaxFileSizeText={uploadMaxFileSizeText}
            newVersionBlockedReason={newVersionBlockedReason}
            canEditContent={canEditContent}
            isAuthor={isAuthor}
            canRestoreContent={canRestoreContent}
            canDeleteContent={canDeleteContent}
            currentCid={contentRecord.ipfsHash}
            onEditTitleChange={setEditTitle}
            onEditDescriptionChange={setEditDescription}
            onEditCidChange={setEditCid}
            onVersionFileChange={handleVersionFileChange}
            onUpdateContent={handleUpdateContent}
            onDeleteContent={handleDeleteContent}
            onRestoreContent={handleRestoreContent}
          />

        </div>
      </div>
    </main>
  );
}
