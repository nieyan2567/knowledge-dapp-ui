"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { txToast, writeTxToast } from "@/lib/tx-toast";
import {
  formatUploadFileSize,
  getUploadMaxFileSizeBytes,
  validateUploadFile,
} from "@/lib/upload-policy";
import { reportClientError } from "@/lib/observability/client";
import type { ContentCardData } from "@/types/content";
import { asContentData } from "@/lib/web3-types";

function parseContentResults(results: readonly unknown[]): ContentCardData[] {
  return results
    .map((item) => asContentData(item))
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

  const readContents = useCallback(
    async (total: number) => {
      if (!publicClient || total <= 0) {
        return [];
      }

      const ids = Array.from({ length: total }, (_, index) => BigInt(index + 1));
      const results = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: CONTRACTS.KnowledgeContent as `0x${string}`,
            abi: ABIS.KnowledgeContent,
            functionName: "contents",
            args: [id],
          })
        )
      );

      return parseContentResults(results);
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
      toast.error("加载内容列表失败");
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
          toast.error("加载内容列表失败");
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    }

    loadContents();

    return () => {
      cancelled = true;
    };
  }, [contentCount, publicClient, readContents]);

  const filteredContents = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return contentList;
    }

    return contentList.filter((item) => {
      return (
        item.title.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword) ||
        item.ipfsHash.toLowerCase().includes(keyword)
      );
    });
  }, [contentList, search]);

  async function handleUploadToIpfs() {
    if (!file) {
      toast.error("请先选择文件");
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
            throw new Error(result.error || "文件上传失败");
          }

          return {
            cid: result.cid,
            url: result.url,
          };
        })(),
        "正在上传文件到 IPFS...",
        "文件上传成功",
        "文件上传失败"
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
          account: address,
        },
        loading: "正在提交链上注册交易...",
        success: "链上注册交易已提交",
        fail: "链上注册失败",
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
        />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">内容列表</h2>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                共 {filteredContents.length} 条
              </div>
            </div>

            <input
              placeholder="搜索标题、描述或 CID..."
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {loadingList ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                正在加载内容列表...
              </div>
            ) : filteredContents.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                暂无匹配内容，请先上传并注册第一条内容。
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredContents.map((item) => (
                  <ContentCard
                    key={item.id.toString()}
                    content={item}
                    onActionComplete={refreshContentList}
                  />
                ))}
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
                  单文件大小上限：{uploadMaxFileSizeText}。当前默认拒绝高风险格式，例如 HTML、JS、SVG、
                  EXE、BAT、PS1、SH 等文件。服务端会重新识别文件真实类型，并对文本内容做风险扫描。
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
                      : "上传至本地 IPFS"}
                </button>

                {uploadedCid && (
                  <div className="space-y-3">
                    <CopyField label="CID" value={uploadedCid} />
                    <CopyField label="本地网关 URL" value={uploadedUrl} />
                  </div>
                )}

                <button
                  onClick={handleRegisterContent}
                  disabled={!uploadedCid || registering}
                  className="w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {registering ? "正在注册..." : "链上注册"}
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      </main>
  );
}
