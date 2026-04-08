"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { useUploadAuth } from "@/hooks/useUploadAuth";
import type { AdminActionLogRecord, NodeRequestRecord } from "@/lib/admin/types";

type SessionResponse = {
  authenticated: boolean;
  address: `0x${string}` | null;
  isAdmin: boolean;
};

type OverviewResponse = {
  pendingNodeRequestCount: number;
  recentNodeRequests: NodeRequestRecord[];
  recentAdminActions: AdminActionLogRecord[];
  allowlist: string[];
  allowlistCount: number;
};

export function AdminOverviewPage() {
  const { address } = useAccount();
  const { ensureUploadAuth, isAuthenticating } = useUploadAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
    address: null,
    isAdmin: false,
  });
  const [overview, setOverview] = useState<OverviewResponse | null>(null);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);

    try {
      const sessionResponse = await fetch("/api/admin/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const sessionData = (await sessionResponse.json()) as
        | SessionResponse
        | { error?: string };
      const sessionError = "error" in sessionData ? sessionData.error : undefined;

      if (!sessionResponse.ok || !("authenticated" in sessionData)) {
        throw new Error(sessionError || "读取管理员会话失败");
      }

      const sessionMatchesWallet =
        !address ||
        !sessionData.address ||
        sessionData.address.toLowerCase() === address.toLowerCase();

      if (!sessionMatchesWallet) {
        setSession({
          authenticated: false,
          address: null,
          isAdmin: false,
        });
        setOverview(null);
        toast.error("检测到钱包已切换，请重新签名。");
        return;
      }

      setSession(sessionData);

      if (!sessionData.isAdmin) {
        setOverview(null);
        return;
      }

      const overviewResponse = await fetch("/api/admin/overview", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const overviewData = (await overviewResponse.json()) as
        | OverviewResponse
        | { error?: string };
      const overviewError = "error" in overviewData ? overviewData.error : undefined;

      if (!overviewResponse.ok || !("allowlistCount" in overviewData)) {
        throw new Error(overviewError || "管理概览加载失败");
      }

      setOverview(overviewData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "管理概览加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const recentSuccessCount = useMemo(
    () => overview?.recentAdminActions.filter((item) => item.success).length ?? 0,
    [overview]
  );

  async function handleAuthenticate() {
    const ok = await ensureUploadAuth();
    if (ok) {
      await loadOverview();
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Admin / Overview"
        title="Admin Console"
        description="在应用层查看节点审批队列、当前 Besu allowlist 状态以及最近的审批动作。"
        right={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              刷新
            </button>
            <Link
              href="/admin/nodes"
              className="inline-flex items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              进入节点审批
            </Link>
          </div>
        }
      />

      {!address ? (
        <SectionCard
          title="钱包连接"
          description="管理后台会将当前连接的钱包地址与 `ADMIN_ADDRESSES` 做比对。"
        >
          <EmptyState>请先连接管理员钱包。</EmptyState>
        </SectionCard>
      ) : isLoading ? (
        <SectionCard title="加载中" description="正在从服务端读取后台状态。">
          <EmptyState>正在加载管理概览...</EmptyState>
        </SectionCard>
      ) : !session.isAdmin ? (
        <SectionCard
          title="管理员校验"
          description="当前钱包要么不在管理员白名单中，要么还没有完成带签名的服务端会话校验。"
          bodyClassName="space-y-4"
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
            当前钱包：{address}
            {session.authenticated
              ? "。该地址不在 ADMIN_ADDRESSES 中。"
              : "。请先完成一次签名挑战，让服务端识别当前钱包。"}
          </div>
          {!session.authenticated ? (
            <button
              type="button"
              disabled={isAuthenticating}
              onClick={() => void handleAuthenticate()}
              className="inline-flex w-fit items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {isAuthenticating ? "校验中..." : "以管理员身份登录"}
            </button>
          ) : null}
        </SectionCard>
      ) : overview ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="待审批节点申请"
              value={String(overview.pendingNodeRequestCount)}
              help="仍在等待审批的申请数"
            />
            <MetricCard
              label="白名单节点数量"
              value={String(overview.allowlistCount)}
              help="从 Besu permissioning 实时读取"
            />
            <MetricCard
              label="最近成功审批数"
              value={String(recentSuccessCount)}
              help="最近成功记录的审批动作数"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <SectionCard
              title="最近节点申请"
              description="最近提交的节点申请及其当前审批状态。"
              className="lg:h-66"
              bodyClassName="flex min-h-0 flex-col"
            >
              {overview.recentNodeRequests.length === 0 ? (
                <EmptyState>暂时还没有节点申请。</EmptyState>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-3">
                    {overview.recentNodeRequests.map((request) => (
                      <article
                        key={request.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                              {request.nodeName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {request.serverHost}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {request.applicantAddress}
                            </div>
                          </div>
                          <StatusTag status={request.status} />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="最近审批记录"
              description="应用层记录的最近节点审批日志。"
              className="lg:h-66"
              bodyClassName="flex min-h-0 flex-col"
            >
              {overview.recentAdminActions.length === 0 ? (
                <EmptyState>暂时还没有审批记录。</EmptyState>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-3">
                    {overview.recentAdminActions.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/30"
                      >
                        <div className="text-sm font-medium text-slate-950 dark:text-slate-100">
                          {item.action === "node_request_approved"
                            ? "已批准节点申请"
                            : "已拒绝节点申请"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          操作人：{item.actorAddress}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          时间：{formatDateTime(item.createTime)}
                        </div>
                        {item.detail ? (
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            备注：{item.detail}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="白名单预览"
            description="展示当前 Besu allowlist 的简要预览，便于快速核对。"
            className="lg:h-72"
            bodyClassName="flex min-h-0 flex-col"
          >
            {overview.allowlist.length === 0 ? (
              <EmptyState>当前 allowlist 为空。</EmptyState>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {overview.allowlist.map((node) => (
                    <div
                      key={node}
                      className="group relative rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-300"
                    >
                      <span className="block truncate leading-5">{node}</span>
                      <div className="pointer-events-none absolute inset-x-3 bottom-full z-20 mb-2 hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg group-hover:block dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                        <span className="block break-all">{node}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </>
      ) : null}
    </main>
  );
}

function MetricCard({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{help}</div>
    </div>
  );
}

function StatusTag({ status }: { status: NodeRequestRecord["status"] }) {
  const styles =
    status === "approved"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : status === "rejected"
        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>
      {status === "approved"
        ? "已批准"
        : status === "rejected"
          ? "已拒绝"
          : "待审批"}
    </span>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-32 flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
      {children}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
