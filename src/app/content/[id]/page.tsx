"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { toast } from "sonner";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import {
  ArrowLeft,
  Coins,
  ExternalLink,
  Heart,
  PencilLine,
  RotateCcw,
  Trash2,
} from "lucide-react";

import {
  ContentCurrentFileSection,
  ContentSnapshotGrid,
  ContentStatusSummaryGrid,
  ContentVersionHistoryList,
} from "@/components/content/content-detail-sections";
import { CopyField } from "@/components/copy-field";
import { FileDrop } from "@/components/file-drop";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useUploadAuth } from "@/hooks/useUploadAuth";
import { BRANDING } from "@/lib/branding";
import {
  buildContentStatusSummary,
  CONTENT_DETAIL_COPY,
  formatUploadVersionDescription,
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
  const updateFee = typeof updateFeeData === "bigint" ? updateFeeData : undefined;

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

  const refreshDetail = useCallback(async () => {
    const [, versionResult] = await Promise.all([refetchContent(), refetchVersionCount()]);
    await loadVersions(
      typeof versionResult.data === "bigint" ? versionResult.data : undefined
    );
  }, [loadVersions, refetchContent, refetchVersionCount]);

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
    void loadVersions();
  }, [loadVersions]);

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
          <SectionCard
            title={CONTENT_DETAIL_COPY.actionsTitle}
            description={CONTENT_DETAIL_COPY.actionsDescription}
          >
            <div className="space-y-3">
              <button
                onClick={handleVote}
                disabled={contentRecord.deleted}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Heart className="h-4 w-4" />
                {CONTENT_DETAIL_COPY.voteButton}
              </button>

              <button
                onClick={handleAccrueReward}
                disabled={contentRecord.deleted || !isAuthor}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Coins className="h-4 w-4" />
                {CONTENT_DETAIL_COPY.accrueRewardButton}
              </button>

              {!isAuthor ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  {CONTENT_DETAIL_COPY.accrueRewardAuthorOnly}
                </div>
              ) : null}

              {canRestoreContent ? (
                <button
                  onClick={handleRestoreContent}
                  disabled={restoring}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 px-5 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                >
                  <RotateCcw className="h-4 w-4" />
                  {restoring
                    ? CONTENT_DETAIL_COPY.restoreLoading
                    : CONTENT_DETAIL_COPY.restoreButton}
                </button>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title={CONTENT_DETAIL_COPY.editTitle}
            description={CONTENT_DETAIL_COPY.editDescription}
          >
              <div className="space-y-4">
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  disabled={!!newVersionBlockedReason || savingEdit || uploadingVersionFile}
                  placeholder={CONTENT_DETAIL_COPY.titlePlaceholder}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                />

                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  disabled={!!newVersionBlockedReason || savingEdit || uploadingVersionFile}
                  placeholder={CONTENT_DETAIL_COPY.descriptionPlaceholder}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {CONTENT_DETAIL_COPY.uploadVersionTitle}
                  </div>
                  <FileDrop file={versionFile} onChange={handleVersionFileChange} />
                  <div className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
                    {formatUploadVersionDescription(uploadMaxFileSizeText)}
                  </div>
                  <button
                    onClick={handleUploadVersionFile}
                    disabled={
                      !!newVersionBlockedReason ||
                      !versionFile ||
                      savingEdit ||
                      uploadingVersionFile ||
                      isAuthenticating
                    }
                    className="mt-3 w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {isAuthenticating
                      ? CONTENT_DETAIL_COPY.uploadVersionAuthenticating
                      : uploadingVersionFile
                        ? CONTENT_DETAIL_COPY.uploadVersionLoading
                        : CONTENT_DETAIL_COPY.uploadVersionIdle}
                  </button>
                </div>

                <input
                  value={editCid}
                  onChange={(event) => setEditCid(event.target.value)}
                  disabled={!!newVersionBlockedReason || savingEdit || uploadingVersionFile}
                  placeholder={CONTENT_DETAIL_COPY.newCidPlaceholder}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                />

                <CopyField
                  label={CONTENT_DETAIL_COPY.currentCidLabel}
                  value={contentRecord.ipfsHash}
                />
                {uploadedVersionUrl ? (
                  <CopyField
                    label={CONTENT_DETAIL_COPY.newVersionGatewayUrlLabel}
                    value={uploadedVersionUrl}
                  />
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {CONTENT_DETAIL_COPY.updateFeeTitle}
                  </div>
                  <div className="mt-1">
                    {updateFee === undefined
                      ? CONTENT_DETAIL_COPY.loadingFee
                      : updateFee > 0n
                        ? `${formatEther(updateFee)} ${BRANDING.nativeTokenSymbol}`
                        : CONTENT_DETAIL_COPY.freeNow}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {CONTENT_DETAIL_COPY.updateFeeDescription}
                  </div>
                </div>

                {newVersionBlockedReason ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                    {newVersionBlockedReason}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                  {canEditContent
                    ? CONTENT_DETAIL_COPY.editHintEditable
                    : isAuthor
                      ? CONTENT_DETAIL_COPY.editHintAuthorBlocked
                      : CONTENT_DETAIL_COPY.editHintNonAuthor}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleUpdateContent}
                    disabled={
                      !!newVersionBlockedReason ||
                      savingEdit ||
                      uploadingVersionFile ||
                      updateFee === undefined
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    <PencilLine className="h-4 w-4" />
                    {savingEdit
                      ? CONTENT_DETAIL_COPY.createVersionLoading
                      : CONTENT_DETAIL_COPY.createVersionIdle}
                  </button>

                  <button
                    onClick={canRestoreContent ? handleRestoreContent : handleDeleteContent}
                    disabled={canRestoreContent ? restoring : !canDeleteContent || deleting}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      canRestoreContent
                        ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                        : "border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    }`}
                  >
                    {canRestoreContent ? (
                      <RotateCcw className="h-4 w-4" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {canRestoreContent
                      ? restoring
                        ? CONTENT_DETAIL_COPY.restoreLoading
                        : CONTENT_DETAIL_COPY.restoreButton
                      : deleting
                        ? CONTENT_DETAIL_COPY.deleteButtonLoading
                        : CONTENT_DETAIL_COPY.deleteButton}
                  </button>
                </div>
              </div>
            </SectionCard>

        </div>
      </div>
    </main>
  );
}
