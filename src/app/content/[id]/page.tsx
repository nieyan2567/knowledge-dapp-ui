"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Coins,
  ExternalLink,
  FileText,
  Heart,
  PencilLine,
  Trash2,
  User,
} from "lucide-react";

import { AddressBadge } from "@/components/address-badge";
import { CopyField } from "@/components/copy-field";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { getIpfsFileUrl } from "@/lib/ipfs";
import { writeTxToast } from "@/lib/tx-toast";
import { asContentData, asContentVersion } from "@/lib/web3-types";
import type { ContentVersionData } from "@/types/content";

function formatDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

export default function ContentDetailPage() {
  const params = useParams();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const refreshAfterTx = useRefreshOnTxConfirmed();

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCid, setEditCid] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versions, setVersions] = useState<ContentVersionData[]>([]);

  const rawId = params?.id;
  const contentId = useMemo(() => {
    if (typeof rawId !== "string") return null;
    if (!/^\d+$/.test(rawId)) return null;
    return BigInt(rawId);
  }, [rawId]);

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

  const content = asContentData(contentData);
  const versionCount = typeof versionCountData === "bigint" ? versionCountData : 0n;

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
      } catch {
        toast.error("Failed to load content versions");
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

  useEffect(() => {
    if (!content) return;
    setEditTitle(content.title);
    setEditDescription(content.description);
    setEditCid(content.ipfsHash);
  }, [content]);

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
          Loading content details...
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
          Back to content list
        </Link>

        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Content not found.
        </div>
      </main>
    );
  }

  const previewUrl = getIpfsFileUrl(content.ipfsHash);
  const isAuthor = !!address && content.author.toLowerCase() === address.toLowerCase();
  const canEditContent =
    isAuthor && !content.deleted && content.voteCount === 0n && !content.rewardAccrued;
  const canDeleteContent = isAuthor && !content.deleted;

  async function handleVote() {
    if (!content) {
      toast.error("Content is unavailable");
      return;
    }

    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "vote",
        args: [content.id],
        account: address,
      },
      loading: "Submitting vote...",
      success: "Vote submitted",
      fail: "Vote failed",
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshDetail, ["content", "dashboard"]);
  }

  async function handleAccrueReward() {
    if (!content) {
      toast.error("Content is unavailable");
      return;
    }

    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "distributeReward",
        args: [content.id],
        account: address,
      },
      loading: "Submitting reward accrual...",
      success: "Reward accrual submitted",
      fail: "Reward accrual failed",
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshDetail, ["content", "rewards", "dashboard", "system"]);
  }

  async function handleUpdateContent() {
    if (!content) {
      toast.error("Content is unavailable");
      return;
    }

    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }

    if (!canEditContent) {
      toast.error("Current content state does not allow editing");
      return;
    }

    if (!editCid.trim() || !editTitle.trim()) {
      toast.error("CID and title are required");
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
          args: [content.id, editCid.trim(), editTitle.trim(), editDescription.trim()],
          account: address,
        },
        loading: "Submitting content update...",
        success: "Content update submitted",
        fail: "Content update failed",
      });

      if (!hash) return;
      await refreshAfterTx(hash, refreshDetail, ["content", "dashboard"]);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteContent() {
    if (!content) {
      toast.error("Content is unavailable");
      return;
    }

    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }

    if (!canDeleteContent) {
      toast.error("Current content state does not allow deletion");
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
          args: [content.id],
          account: address,
        },
        loading: "Submitting content deletion...",
        success: "Content deletion submitted",
        fail: "Content deletion failed",
      });

      if (!hash) return;
      await refreshAfterTx(hash, refreshDetail, ["content", "dashboard"]);
    } finally {
      setDeleting(false);
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
          Back to content list
        </Link>

        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Open current IPFS file
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <PageHeader
        eyebrow={`Content #${content.id.toString()}`}
        title={content.title}
        description={content.description || "No description"}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SectionCard
            title="Current File"
            description="The latest version snapshot points to the current CID stored on-chain."
          >
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
                    Open current file
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Version v{content.latestVersion.toString()} stored at the active CID.
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300">
                  Open file
                  <ExternalLink className="h-4 w-4" />
                </div>
              </div>
            </a>
          </SectionCard>

          <SectionCard
            title="Content Snapshot"
            description="The current content record now includes snapshot fields and version metadata."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Author
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
                  <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <AddressBadge address={content.author} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Created At
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {formatDate(content.timestamp)}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Latest Version
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  v{content.latestVersion.toString()} / {versionCount.toString()} stored
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Last Updated
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {formatDate(content.lastUpdatedAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Votes
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <Heart className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {content.voteCount.toString()}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Reward Status
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <CheckCircle2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {content.rewardAccrued ? "Accrued" : "Pending"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Content Status
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {content.deleted ? "Deleted" : "Active"}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Version History"
            description="Older CID snapshots stay pinned and indexed on-chain as immutable versions."
          >
            {loadingVersions ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                Loading version history...
              </div>
            ) : versions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                No versions found.
              </div>
            ) : (
              <div className="space-y-4">
                {versions.map((version) => {
                  const isCurrentVersion = version.version === content.latestVersion;
                  const versionUrl = getIpfsFileUrl(version.ipfsHash);

                  return (
                    <div
                      key={version.version.toString()}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                            Version v{version.version.toString()}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Stored at {formatDate(version.timestamp)}
                          </div>
                        </div>

                        <div
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isCurrentVersion
                              ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                              : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                          }`}
                        >
                          {isCurrentVersion ? "Current" : "Historical"}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <div>Title: {version.title}</div>
                        <div>Description: {version.description || "No description"}</div>
                        <div className="break-all text-xs text-slate-500 dark:text-slate-400">
                          CID: {version.ipfsHash}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <a
                          href={versionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Open file
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
            title="Content Actions"
            description="Voting and reward accrual stay available only while the content remains active."
          >
            <div className="space-y-3">
              <button
                onClick={handleVote}
                disabled={content.deleted}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Heart className="h-4 w-4" />
                Vote
              </button>

              <button
                onClick={handleAccrueReward}
                disabled={content.deleted}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Coins className="h-4 w-4" />
                Accrue reward
              </button>
            </div>
          </SectionCard>

          {isAuthor && (
            <SectionCard
              title="Author Actions"
              description="Updating content creates a new on-chain version and keeps earlier CIDs available in history."
            >
              <div className="space-y-3">
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  disabled={!canEditContent || savingEdit}
                  placeholder="Content title"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                />

                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  disabled={!canEditContent || savingEdit}
                  placeholder="Content description"
                  rows={4}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                />

                <input
                  value={editCid}
                  onChange={(event) => setEditCid(event.target.value)}
                  disabled={!canEditContent || savingEdit}
                  placeholder="New IPFS CID"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                  {canEditContent
                    ? "Upload the new file first, then submit the replacement CID. The old CID remains pinned and will stay visible in version history."
                    : "Editing is locked after deletion, after any vote, or once rewards have entered the accrual flow."}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleUpdateContent}
                    disabled={!canEditContent || savingEdit}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    <PencilLine className="h-4 w-4" />
                    {savingEdit ? "Updating..." : "Create new version"}
                  </button>

                  <button
                    onClick={handleDeleteContent}
                    disabled={!canDeleteContent || deleting}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-300 px-5 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleting ? "Deleting..." : "Soft delete"}
                  </button>
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Current Metadata"
            description="The active content record points to the latest snapshot only."
          >
            <div className="space-y-3">
              <CopyField label="Current CID" value={content.ipfsHash} />
              <CopyField label="Gateway URL" value={previewUrl} />
            </div>
          </SectionCard>

          <SectionCard
            title="Record Summary"
            description="Quick summary of the current content record."
          >
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span>Content ID: {content.id.toString()}</span>
              </div>
              <div>Title: {content.title}</div>
              <div>Description: {content.description || "No description"}</div>
              <div>Latest version: v{content.latestVersion.toString()}</div>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
