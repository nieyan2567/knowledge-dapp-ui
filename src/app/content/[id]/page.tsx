"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
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
import { readContentDetailFromChain } from "@/lib/content-chain";
import {
  fetchIndexedContentDetail,
  fetchIndexedSystemSnapshot,
} from "@/lib/indexer-api";
import { getIpfsFileUrl } from "@/lib/ipfs";
import { reportClientError } from "@/lib/observability/client";
import { readContentUpdateConfigFromChain } from "@/lib/system-chain";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import { txToast, writeTxToast } from "@/lib/tx-toast";
import {
  formatUploadFileSize,
  getUploadMaxFileSizeBytes,
  validateUploadFile,
} from "@/lib/upload-policy";
import type { ContentData, ContentVersionData } from "@/types/content";

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
  const [uploadedVersionUrl, setUploadedVersionUrl] = useState("");
  const [uploadingVersionFile, setUploadingVersionFile] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versions, setVersions] = useState<ContentVersionData[]>([]);
  const [content, setContent] = useState<ContentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [versionCount, setVersionCount] = useState<bigint>(0n);
  const [rewardAccrualCount, setRewardAccrualCount] = useState<bigint>(0n);
  const [maxVersionsPerContent, setMaxVersionsPerContent] = useState<bigint | undefined>(
    undefined
  );
  const [updateFee, setUpdateFee] = useState<bigint | undefined>(undefined);

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

  const loadDetail = useCallback(async () => {
    if (!contentId) {
      setContent(null);
      setVersions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadingVersions(true);

    try {
      const [indexedDetail, indexedSystemSnapshot] = await Promise.all([
        fetchIndexedContentDetail(contentId),
        fetchIndexedSystemSnapshot(),
      ]);

      if (indexedDetail) {
        setContent(indexedDetail.content);
        setVersions(indexedDetail.versions);
        setVersionCount(BigInt(indexedDetail.versions.length));
        setRewardAccrualCount(indexedDetail.content.rewardAccrualCount);
        if (indexedSystemSnapshot) {
          setMaxVersionsPerContent(
            BigInt(indexedSystemSnapshot.max_versions_per_content)
          );
          setUpdateFee(BigInt(indexedSystemSnapshot.content_update_fee_amount));
        } else if (publicClient) {
          const updateConfig = await readContentUpdateConfigFromChain(publicClient);
          setMaxVersionsPerContent(updateConfig.maxVersionsPerContent);
          setUpdateFee(updateConfig.updateFee);
        }
        return;
      }

      if (!publicClient) {
        setContent(null);
        setVersions([]);
        return;
      }

      const [fallbackDetail, updateConfig] = await Promise.all([
        readContentDetailFromChain(publicClient, contentId),
        readContentUpdateConfigFromChain(publicClient),
      ]);

      setContent(fallbackDetail.content);
      setVersionCount(fallbackDetail.versionCount);
      setRewardAccrualCount(fallbackDetail.rewardAccrualCount);
      setVersions(fallbackDetail.versions);
      setMaxVersionsPerContent(updateConfig.maxVersionsPerContent);
      setUpdateFee(updateConfig.updateFee);
    } catch (error) {
      reportContentDetailError("Failed to load content detail", error, {
        contentId: contentId.toString(),
      });
      toast.error(CONTENT_DETAIL_COPY.loadVersionsFailed);
    } finally {
      setIsLoading(false);
      setLoadingVersions(false);
    }
  }, [contentId, publicClient]);

  const refreshDetail = useCallback(async () => {
    await loadDetail();
  }, [loadDetail]);

  const currentContentId = content?.id;
  const currentContentTitle = content?.title;
  const currentContentDescription = content?.description;
  const currentContentCid = content?.ipfsHash;
  const currentContentLatestVersion = content?.latestVersion;
  const currentContentDeleted = content?.deleted;

  useEffect(() => {
    if (!currentContentTitle || currentContentDescription === undefined || !currentContentCid) {
      return;
    }

    setEditTitle(currentContentTitle);
    setEditDescription(currentContentDescription);
    setEditCid(currentContentCid);
    setVersionFile(null);
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
    void loadDetail();
  }, [loadDetail]);

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
  const hasReachedMaxVersions =
    maxVersionsPerContent !== undefined && versionCount >= maxVersionsPerContent;
  const canEditContent = isAuthor && !contentRecord.deleted && !hasReachedMaxVersions;
  const canDeleteContent = isAuthor && !contentRecord.deleted;
  const canRestoreContent = isAuthor && contentRecord.deleted;
  const newVersionBlockedReason = !isAuthor
    ? "只有内容作者可以创建新版本。"
    : contentRecord.deleted
      ? "内容已软删除，恢复后才能继续创建新版本。"
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

  function handleVersionFileChange(selectedFile: File) {
    const uploadValidation = validateUploadFile(selectedFile);

    if (!uploadValidation.ok) {
      toast.error(uploadValidation.error);
      return;
    }

    setVersionFile(selectedFile);
  }

  async function handleUploadVersionFile() {
    if (!content) {
      toast.error(CONTENT_DETAIL_COPY.unavailable);
      return;
    }

    if (newVersionBlockedReason) {
      toast.error(newVersionBlockedReason);
      return;
    }

    if (!versionFile) {
      toast.error(CONTENT_DETAIL_COPY.uploadVersionFileRequired);
      return;
    }

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
            throw new Error(result.error || CONTENT_DETAIL_COPY.uploadVersionFailed);
          }

          return {
            cid: result.cid,
            url: result.url,
          };
        })(),
        CONTENT_DETAIL_COPY.uploadVersionLoadingToast,
        CONTENT_DETAIL_COPY.uploadVersionSuccess,
        CONTENT_DETAIL_COPY.uploadVersionFailed
      );

      setEditCid(data.cid);
      setUploadedVersionUrl(data.url);
    } catch (error) {
      reportContentDetailError("Failed to upload replacement content file", error, {
        contentId: content.id.toString(),
        fileName: versionFile.name,
      });
    } finally {
      setUploadingVersionFile(false);
    }
  }

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

    if (!editCid.trim()) {
      toast.error(CONTENT_DETAIL_COPY.updateCidRequired);
      return;
    }

    if (updateFee === undefined) {
      toast.error(CONTENT_DETAIL_COPY.updateFeeLoading);
      return;
    }

    setSavingEdit(true);

    try {
      const hash = await writeTxToast({
        publicClient,
        writeContractAsync,
        request: {
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "updateContent",
          args: [
            contentRecord.id,
            editCid.trim(),
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

      if (!hash) return;

      await refreshAfterTx(hash, refreshDetail, ["content", "dashboard"]);
      setVersionFile(null);
      setUploadedVersionUrl("");
    } finally {
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
            onUploadVersionFile={handleUploadVersionFile}
            onUpdateContent={handleUpdateContent}
            onDeleteContent={handleDeleteContent}
            onRestoreContent={handleRestoreContent}
          />

        </div>
      </div>
    </main>
  );
}
