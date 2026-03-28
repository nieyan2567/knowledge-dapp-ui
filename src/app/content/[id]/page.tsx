"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Coins,
  ExternalLink,
  FileText,
  Heart,
  PencilLine,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";

import { AddressBadge } from "@/components/address-badge";
import { CopyField } from "@/components/copy-field";
import { FileDrop } from "@/components/file-drop";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useUploadAuth } from "@/hooks/useUploadAuth";
import { getIpfsFileUrl } from "@/lib/ipfs";
import { reportClientError } from "@/lib/observability/client";
import { txToast, writeTxToast } from "@/lib/tx-toast";
import {
  formatUploadFileSize,
  getUploadMaxFileSizeBytes,
  validateUploadFile,
} from "@/lib/upload-policy";
import { asContentData, asContentVersion } from "@/lib/web3-types";
import type { ContentVersionData } from "@/types/content";

function formatDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    hour12: false,
  });
}

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

  const { data: maxVersionsPerContentData } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "maxVersionsPerContent",
  });

  const content = asContentData(contentData);
  const versionCount = typeof versionCountData === "bigint" ? versionCountData : 0n;
  const maxVersionsPerContent =
    typeof maxVersionsPerContentData === "bigint" ? maxVersionsPerContentData : undefined;

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
        toast.error("加载内容版本历史失败");
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

  if (!contentId) {
    notFound();
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          正在加载内容详情...
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
          返回内容列表
        </Link>

        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          未找到该内容。
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
      toast.error("内容暂不可用");
      return;
    }

    if (newVersionBlockedReason) {
      toast.error(newVersionBlockedReason);
      return;
    }

    if (!versionFile) {
      toast.error("请先选择新版本文件");
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
            throw new Error(result.error || "新版本文件上传失败");
          }

          return {
            cid: result.cid,
            url: result.url,
          };
        })(),
        "正在上传新版本文件到 IPFS...",
        "新版本文件上传成功",
        "新版本文件上传失败"
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
      toast.error("请先连接钱包");
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
      loading: "正在提交投票...",
      success: "投票交易已提交",
      fail: "投票失败",
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshDetail, ["content", "dashboard"]);
  }

  async function handleAccrueReward() {
    if (!address) {
      toast.error("请先连接钱包");
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
      loading: "正在提交奖励记账...",
      success: "奖励记账交易已提交",
      fail: "奖励记账失败",
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshDetail, ["content", "rewards", "dashboard", "system"]);
  }

  async function handleUpdateContent() {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    if (newVersionBlockedReason) {
      toast.error("当前内容状态不允许创建新版本");
      return;
    }

    if (!editTitle.trim()) {
      toast.error("请输入内容标题");
      return;
    }

    if (!editCid.trim()) {
      toast.error("请先上传新文件或填写新的 CID");
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
          account: address,
        },
        loading: "正在提交新版本...",
        success: "新版本交易已提交",
        fail: "创建新版本失败",
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
      toast.error("请先连接钱包");
      return;
    }

    if (!canDeleteContent) {
      toast.error("当前内容状态不允许删除");
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
        loading: "正在提交删除交易...",
        success: "删除交易已提交",
        fail: "删除失败",
      });

      if (!hash) return;
      await refreshAfterTx(hash, refreshDetail, ["content", "dashboard"]);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRestoreContent() {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    if (!canRestoreContent) {
      toast.error("当前内容状态不允许恢复");
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
        loading: "正在提交恢复交易...",
        success: "恢复交易已提交",
        fail: "恢复失败",
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
          返回内容列表
        </Link>

        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          查看当前 IPFS 文件
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <PageHeader
        eyebrow={`内容 #${contentRecord.id.toString()}`}
        title={contentRecord.title}
        description={contentRecord.description || "暂无描述"}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SectionCard
            title="当前文件"
            description="把记录摘要、文件入口和当前元数据集中到同一处查看。"
          >
            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <BookOpen className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  记录摘要
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      内容 ID
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      #{contentRecord.id.toString()}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      最新版本
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      v{contentRecord.latestVersion.toString()}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      状态
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {contentRecord.deleted ? "已删除" : "正常"}
                    </div>
                  </div>
                </div>
                <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      标题
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">
                      {contentRecord.title}
                    </span>
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      描述
                    </span>
                    <span className="flex-1 text-xs leading-5 text-slate-700 dark:text-slate-300">
                      {contentRecord.description || "暂无描述"}
                    </span>
                  </div>
                </div>
              </div>

              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-3xl border border-slate-200 bg-slate-50 p-8 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
              >
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                    <FileText className="h-8 w-8" />
                  </div>

                  <div>
                    <div className="text-base font-semibold text-slate-950 dark:text-slate-100">
                      打开当前文件
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      当前激活版本为 v{contentRecord.latestVersion.toString()}
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300">
                    打开文件
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
              </a>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  当前元数据
                </div>
                <div className="space-y-3">
                  <CopyField label="当前 CID" value={content.ipfsHash} />
                  <CopyField label="网关地址" value={previewUrl} />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="内容快照"
            description="当前内容记录包含最新快照和版本元数据。"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard label="作者">
                <div className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
                  <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <AddressBadge address={contentRecord.author} />
                </div>
              </InfoCard>

              <InfoCard label="创建时间">{formatDate(contentRecord.timestamp)}</InfoCard>
              <InfoCard label="最新版本">
                v{contentRecord.latestVersion.toString()} / {versionCount.toString()} 个版本
              </InfoCard>
              <InfoCard label="最后更新时间">
                {formatDate(contentRecord.lastUpdatedAt)}
              </InfoCard>
              <InfoCard label="票数">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {contentRecord.voteCount.toString()}
                </div>
              </InfoCard>
              <InfoCard label="奖励状态">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {contentRecord.rewardAccrued ? "已记账" : "未记账"}
                </div>
              </InfoCard>
            </div>
          </SectionCard>

          <SectionCard
            title="版本历史"
            description="历史 CID 会继续保留并作为链上版本记录展示。"
          >
            {loadingVersions ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                正在加载版本历史...
              </div>
            ) : versions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                暂无版本记录。
              </div>
            ) : (
              <div className="space-y-4">
                {versions.map((version) => {
                  const isCurrentVersion =
                    version.version === contentRecord.latestVersion;
                  const versionUrl = getIpfsFileUrl(version.ipfsHash);

                  return (
                    <div
                      key={version.version.toString()}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                            版本 v{version.version.toString()}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            记录时间：{formatDate(version.timestamp)}
                          </div>
                        </div>

                        <div
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isCurrentVersion
                              ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                              : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                          }`}
                        >
                          {isCurrentVersion ? "当前版本" : "历史版本"}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <div>标题：{version.title}</div>
                        <div>描述：{version.description || "暂无描述"}</div>
                        <div className="break-all text-xs text-slate-500 dark:text-slate-400">
                          CID：{version.ipfsHash}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <a
                          href={versionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          打开文件
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="内容操作"
            description="内容未删除时可以继续投票和记账。"
          >
            <div className="space-y-3">
              <button
                onClick={handleVote}
                disabled={contentRecord.deleted}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Heart className="h-4 w-4" />
                投票
              </button>

              <button
                onClick={handleAccrueReward}
                disabled={contentRecord.deleted}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Coins className="h-4 w-4" />
                奖励记账
              </button>

              {canRestoreContent ? (
                <button
                  onClick={handleRestoreContent}
                  disabled={restoring}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 px-5 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                >
                  <RotateCcw className="h-4 w-4" />
                  {restoring ? "正在恢复..." : "恢复内容"}
                </button>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="新版本编辑"
            description="更新内容会创建一个新的链上版本，并保留旧 CID 作为历史版本。"
          >
              <div className="space-y-4">
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  disabled={!!newVersionBlockedReason || savingEdit || uploadingVersionFile}
                  placeholder="内容标题"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                />

                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  disabled={!!newVersionBlockedReason || savingEdit || uploadingVersionFile}
                  placeholder="内容描述"
                  rows={4}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                    上传新版本文件
                  </div>
                  <FileDrop file={versionFile} onChange={handleVersionFileChange} />
                  <div className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
                    单文件大小上限：{uploadMaxFileSizeText}。上传成功后会自动把新 CID 回填到下方输入框。
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
                      ? "正在验证上传身份..."
                      : uploadingVersionFile
                        ? "正在上传新版本文件..."
                        : "上传新版本文件"}
                  </button>
                </div>

                <input
                  value={editCid}
                  onChange={(event) => setEditCid(event.target.value)}
                  disabled={!!newVersionBlockedReason || savingEdit || uploadingVersionFile}
                  placeholder="新的 IPFS CID"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                />

                <CopyField label="当前 CID" value={contentRecord.ipfsHash} />
                {uploadedVersionUrl ? (
                  <CopyField label="新版本网关地址" value={uploadedVersionUrl} />
                ) : null}

                {newVersionBlockedReason ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                    {newVersionBlockedReason}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                  {canEditContent
                    ? "你现在可以直接修改标题和描述，也可以先上传一个新的文件生成新 CID，再提交链上更新。是否允许创建新版本，最终由合约当前内容策略决定。"
                    : isAuthor
                      ? "当前内容状态可能已被合约策略限制，表单仍可编辑，但真正提交时会按链上规则校验。"
                      : "你可以先准备标题、描述和新 CID；只有作者地址才能真正提交新版本。"}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleUpdateContent}
                    disabled={!!newVersionBlockedReason || savingEdit || uploadingVersionFile}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    <PencilLine className="h-4 w-4" />
                    {savingEdit ? "正在创建新版本..." : "创建新版本"}
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
                        ? "正在恢复..."
                        : "恢复内容"
                      : deleting
                        ? "正在删除..."
                        : "软删除"}
                  </button>
                </div>
              </div>
            </SectionCard>

        </div>
      </div>
    </main>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{children}</div>
    </div>
  );
}
