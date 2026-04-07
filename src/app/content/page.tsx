"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
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
  CONTENT_PAGE_COPY,
  CONTENTS_PER_PAGE,
  filterContentList,
  paginateContentList,
  sortContentList,
} from "@/lib/content-page-helpers";
import {
  readContentCountFromChain,
  readContentsFromChain,
} from "@/lib/content-chain";
import { fetchAllIndexedContents, fetchIndexedSystemSnapshot } from "@/lib/indexer-api";
import { reportClientError } from "@/lib/observability/client";
import { readContentRegisterFeeFromChain } from "@/lib/system-chain";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import { txToast, writeTxToast } from "@/lib/tx-toast";
import {
  formatUploadFileSize,
  getUploadMaxFileSizeBytes,
  validateUploadFile,
} from "@/lib/upload-policy";
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
  const [registerFee, setRegisterFee] = useState<bigint | undefined>(undefined);

  const uploadMaxFileSizeText = useMemo(
    () => formatUploadFileSize(getUploadMaxFileSizeBytes()),
    []
  );

  const readContents = useCallback(
    async (total: number) => {
      if (!publicClient || total <= 0) {
        return [] satisfies ContentCardData[];
      }

      return readContentsFromChain(publicClient, total);
    },
    [publicClient]
  );

  const loadRegisterFee = useCallback(async () => {
    const indexedSystemSnapshot = await fetchIndexedSystemSnapshot();

    if (indexedSystemSnapshot) {
      setRegisterFee(BigInt(indexedSystemSnapshot.content_register_fee_amount));
      return;
    }

    if (!publicClient) {
      setRegisterFee(undefined);
      return;
    }

    setRegisterFee(await readContentRegisterFeeFromChain(publicClient));
  }, [publicClient]);

  const refreshContentList = useCallback(async () => {
    setLoadingList(true);

    try {
      const indexedContents = await fetchAllIndexedContents();

      if (indexedContents) {
        setContentList(indexedContents);
        return;
      }

      if (!publicClient) {
        setContentList([]);
        return;
      }

      const latestCount = Number(await readContentCountFromChain(publicClient));
      const parsed = await readContents(latestCount);
      setContentList(parsed);
    } catch (error) {
      reportContentPageError("Failed to refresh content list", error);
      toast.error(CONTENT_PAGE_COPY.loadListFailed);
    } finally {
      setLoadingList(false);
    }
  }, [publicClient, readContents]);

  useEffect(() => {
    let cancelled = false;

    async function loadContents() {
      setLoadingList(true);

      try {
        const indexedContents = await fetchAllIndexedContents();

        if (indexedContents) {
          if (!cancelled) {
            setContentList(indexedContents);
          }
          return;
        }

        if (!publicClient) {
          if (!cancelled) {
            setContentList([]);
          }
          return;
        }

        const chainContentCount = await readContentCountFromChain(publicClient);
        const parsed = await readContents(Number(chainContentCount));

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
  }, [publicClient, readContents]);

  useEffect(() => {
    void loadRegisterFee();
  }, [loadRegisterFee]);

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
          registerFee={registerFee}
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

