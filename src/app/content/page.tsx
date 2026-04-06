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
import {
  CONTENT_FETCH_CHUNK_SIZE,
  CONTENT_PAGE_COPY,
  CONTENTS_PER_PAGE,
  filterContentList,
  formatContentCountSummary,
  formatContentPaginationSummary,
  formatUploadPolicyDescription,
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
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
              {CONTENT_PAGE_COPY.listTitle}
            </h2>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {formatContentCountSummary(sortedContents.length)}
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
            <input
              placeholder={CONTENT_PAGE_COPY.searchPlaceholder}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as "all" | "mine")}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400"
            >
              <option value="all">{CONTENT_PAGE_COPY.scopeAll}</option>
              <option value="mine">{CONTENT_PAGE_COPY.scopeMine}</option>
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as ContentSortKey)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400"
            >
              <option value="updated_desc">{CONTENT_PAGE_COPY.sortUpdated}</option>
              <option value="created_desc">{CONTENT_PAGE_COPY.sortCreated}</option>
              <option value="votes_desc">{CONTENT_PAGE_COPY.sortVotes}</option>
              <option value="versions_desc">{CONTENT_PAGE_COPY.sortVersions}</option>
            </select>
          </div>

          {loadingList ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {CONTENT_PAGE_COPY.loadingList}
            </div>
          ) : sortedContents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              {CONTENT_PAGE_COPY.emptyList}
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
                  {formatContentPaginationSummary(
                    page,
                    totalPages,
                    CONTENTS_PER_PAGE
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {CONTENT_PAGE_COPY.prevPage}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {CONTENT_PAGE_COPY.nextPage}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <SectionCard
            title={CONTENT_PAGE_COPY.uploadTitle}
            description={CONTENT_PAGE_COPY.uploadDescription}
          >
            <div className="space-y-4">
              <input
                placeholder={CONTENT_PAGE_COPY.titlePlaceholder}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
              />

              <textarea
                placeholder={CONTENT_PAGE_COPY.descriptionPlaceholder}
                value={desc}
                onChange={(event) => setDesc(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
              />

              <FileDrop file={file} onChange={handleFileChange} />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                {formatUploadPolicyDescription(uploadMaxFileSizeText)}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {CONTENT_PAGE_COPY.registerFeeTitle}
                </div>
                <div className="mt-1">
                  {typeof registerFee === "bigint"
                    ? registerFee > 0n
                      ? `${formatEther(registerFee)} ${BRANDING.nativeTokenSymbol}`
                      : CONTENT_PAGE_COPY.freeNow
                    : CONTENT_PAGE_COPY.loadingFee}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {CONTENT_PAGE_COPY.registerFeeDescription}
                </div>
              </div>

              <button
                onClick={handleUploadToIpfs}
                disabled={!file || uploading || isAuthenticating}
                className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {isAuthenticating
                  ? CONTENT_PAGE_COPY.authenticating
                  : uploading
                    ? CONTENT_PAGE_COPY.uploading
                    : CONTENT_PAGE_COPY.uploadToLocalIpfs}
              </button>

              {uploadedCid && (
                <div className="space-y-3">
                  <CopyField label="CID" value={uploadedCid} />
                  <CopyField label={CONTENT_PAGE_COPY.localGatewayUrl} value={uploadedUrl} />
                </div>
              )}

              <button
                onClick={handleRegisterContent}
                disabled={!uploadedCid || registering || registerFee === undefined}
                className="w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {registering
                  ? CONTENT_PAGE_COPY.registering
                  : CONTENT_PAGE_COPY.registerOnchain}
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}

