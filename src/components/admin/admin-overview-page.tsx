"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useUploadAuth } from "@/hooks/useUploadAuth";
import type { AdminActionLogRecord, AdminSessionResponse, NodeRequestRecord } from "@/lib/admin/types";

type OverviewResponse = {
  pendingNodeRequestCount: number;
  approvedNodeRequestCount: number;
  revokedNodeRequestCount: number;
  rejectedNodeRequestCount: number;
  pendingValidatorRequestCount: number;
  approvedValidatorRequestCount: number;
  rejectedValidatorRequestCount: number;
  validatorRemovalVoteCount: number;
  recentNodeRequests: NodeRequestRecord[];
  recentAdminActions: AdminActionLogRecord[];
  allowlist: string[];
  allowlistCount: number;
  currentValidators: `0x${string}`[];
  currentValidatorCount: number;
};

type LoadOverviewOptions = { background?: boolean; silent?: boolean };

export function AdminOverviewPage() {
  const { address } = useAccount();
  const { ensureUploadAuth, isAuthenticating } = useUploadAuth();
  const authAttemptedForAddress = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<AdminSessionResponse>({ authenticated: false, address: null, isAdmin: false });
  const [overview, setOverview] = useState<OverviewResponse | null>(null);

  const loadOverview = useCallback(async ({ background = false, silent = false }: LoadOverviewOptions = {}) => {
    if (!background) setIsLoading(true);
    try {
      const sessionResponse = await fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" });
      const sessionData = (await sessionResponse.json()) as AdminSessionResponse | { error?: string };
      const sessionError = "error" in sessionData ? sessionData.error : undefined;
      if (!sessionResponse.ok || !("authenticated" in sessionData)) throw new Error(sessionError || "读取钱包签名状态失败");

      const sessionMatchesWallet = !address || !sessionData.address || sessionData.address.toLowerCase() === address.toLowerCase();
      if (!sessionMatchesWallet) {
        setSession({ authenticated: false, address: null, isAdmin: false });
        setOverview(null);
        if (!silent) toast.error("检测到钱包已切换，请重新完成签名验证。");
        return;
      }

      setSession(sessionData);
      if (!sessionData.isAdmin) {
        setOverview(null);
        return;
      }

      const overviewResponse = await fetch("/api/admin/overview", { cache: "no-store", credentials: "same-origin" });
      const overviewData = (await overviewResponse.json()) as OverviewResponse | { error?: string };
      const overviewError = "error" in overviewData ? overviewData.error : undefined;
      if (!overviewResponse.ok || !("allowlistCount" in overviewData)) throw new Error(overviewError || "管理概览读取失败，请稍后重试");
      setOverview(overviewData);
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "管理概览读取失败，请稍后重试");
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [address]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useAutoRefresh({ enabled: !!address && session.authenticated, onRefresh: () => loadOverview({ background: true, silent: true }) });

  useEffect(() => {
    if (!address) { authAttemptedForAddress.current = null; return; }
    const normalizedAddress = address.toLowerCase();
    if (session.authenticated || isAuthenticating || isLoading) return;
    if (authAttemptedForAddress.current === normalizedAddress) return;
    authAttemptedForAddress.current = normalizedAddress;
    void (async () => {
      const ok = await ensureUploadAuth();
      if (ok) await loadOverview({ background: !!overview });
    })();
  }, [address, ensureUploadAuth, isAuthenticating, isLoading, loadOverview, overview, session.authenticated]);

  const recentSuccessCount = useMemo(() => overview?.recentAdminActions.filter((item) => item.success).length ?? 0, [overview]);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Admin / Overview"
        title="Admin Console"
        description="在应用后台查看节点申请、Validator 申请、当前 allowlist、当前 Validator 集合和最近审批动作。"
        right={<div className="flex flex-wrap gap-3"><Link href="/admin/nodes" className="inline-flex items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">进入节点管理</Link><Link href="/admin/validators" className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">进入 Validator 管理</Link></div>}
      />

      {!address ? (
        <SectionCard title="钱包连接" description="管理页面会根据当前连接的钱包地址识别是否具备管理员权限。">
          <EmptyState>请先连接钱包。</EmptyState>
        </SectionCard>
      ) : isLoading ? (
        <SectionCard title="加载中" description="正在读取当前钱包的会话状态和管理概览。">
          <EmptyState>正在加载管理概览...</EmptyState>
        </SectionCard>
      ) : !session.authenticated ? (
        <SectionCard title="钱包签名验证" description="进入管理页面后会自动发起一次签名验证，用于建立当前钱包的服务端会话。">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">当前钱包：{address}<br />{isAuthenticating ? "正在请求钱包签名，完成后会自动判断该地址是否具备管理员权限。" : "如果你刚刚取消了签名，重新进入页面或重新连接钱包后会再次触发验证流程。"}</div>
        </SectionCard>
      ) : !session.isAdmin ? (
        <SectionCard title="权限状态" description="当前钱包已经完成签名验证，但这个地址不在管理员白名单中。" bodyClassName="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">当前钱包：{session.address}<br />如果你需要审批权限，请把该地址加入管理员名单后重新进入页面。</div>
          <Link href="/admin/nodes" className="inline-flex w-fit items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">查看节点申请</Link>
        </SectionCard>
      ) : overview ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard title="待审批节点申请" value={String(overview.pendingNodeRequestCount)} description="仍在等待管理员处理的普通节点申请数量" className="px-5 py-4 hover:translate-y-0 hover:shadow-sm" headerClassName="mb-2" titleClassName="font-bold text-slate-700 dark:text-slate-200" valueClassName="min-h-0 text-2xl font-semibold" descriptionClassName="mt-1 text-xs leading-5" />
            <StatCard title="待审批 Validator 申请" value={String(overview.pendingValidatorRequestCount)} description="等待发起 QBFT 投票的 Validator 申请数量" className="px-5 py-4 hover:translate-y-0 hover:shadow-sm" headerClassName="mb-2" titleClassName="font-bold text-slate-700 dark:text-slate-200" valueClassName="min-h-0 text-2xl font-semibold" descriptionClassName="mt-1 text-xs leading-5" />
            <StatCard title="当前 Validator 数" value={String(overview.currentValidatorCount)} description="基于当前链上 QBFT Validator 集合实时读取" className="px-5 py-4 hover:translate-y-0 hover:shadow-sm" headerClassName="mb-2" titleClassName="font-bold text-slate-700 dark:text-slate-200" valueClassName="min-h-0 text-2xl font-semibold" descriptionClassName="mt-1 text-xs leading-5" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="节点生命周期概览" description="把普通节点从申请、批准到撤销的状态拆开显示，便于确认当前接入面。">
              <div className="grid gap-3 sm:grid-cols-2">
                <LifecyclePill label="待审批" value={overview.pendingNodeRequestCount} tone="warn" />
                <LifecyclePill label="已批准" value={overview.approvedNodeRequestCount} tone="success" />
                <LifecyclePill label="已撤销" value={overview.revokedNodeRequestCount} tone="neutral" />
                <LifecyclePill label="已拒绝" value={overview.rejectedNodeRequestCount} tone="danger" />
              </div>
            </SectionCard>
            <SectionCard title="Validator 生命周期概览" description="区分申请待审批、已发起加入投票、当前在集合中以及已发起移除投票。">
              <div className="grid gap-3 sm:grid-cols-2">
                <LifecyclePill label="待审批" value={overview.pendingValidatorRequestCount} tone="warn" />
                <LifecyclePill label="已发起加入投票" value={overview.approvedValidatorRequestCount} tone="success" />
                <LifecyclePill label="当前在集合中" value={overview.currentValidatorCount} tone="info" />
                <LifecyclePill label="已发起移除投票" value={overview.validatorRemovalVoteCount} tone="danger" />
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <SectionCard title="最近节点申请" description="最近提交的普通节点申请及其当前生命周期状态。" className="lg:h-66" bodyClassName="flex min-h-0 flex-col">
              {overview.recentNodeRequests.length === 0 ? <EmptyState>暂时还没有节点申请。</EmptyState> : <div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="space-y-3">{overview.recentNodeRequests.map((request) => <article key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/30"><div className="flex items-start justify-between gap-3"><div className="space-y-1"><div className="text-sm font-semibold text-slate-950 dark:text-slate-100">{request.nodeName}</div><div className="text-xs text-slate-500 dark:text-slate-400">{request.serverHost}</div><div className="text-xs text-slate-500 dark:text-slate-400">{request.applicantAddress}</div></div><StatusTag status={request.status} /></div></article>)}</div></div>}
            </SectionCard>

            <SectionCard title="最近审批记录" description="最近的节点与 Validator 审批日志，已区分批准、拒绝、撤销和移除投票。" className="lg:h-66" bodyClassName="flex min-h-0 flex-col">
              {overview.recentAdminActions.length === 0 ? <EmptyState>暂时还没有审批记录。</EmptyState> : <div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="space-y-3">{overview.recentAdminActions.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/30"><div className="text-sm font-medium text-slate-950 dark:text-slate-100">{describeAction(item.action)}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">操作人：{item.actorAddress}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">时间：{formatDateTime(item.createTime)}</div>{item.detail ? <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">备注：{item.detail}</div> : null}</article>)}</div></div>}
            </SectionCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="白名单预览" description="展示当前 Besu allowlist 摘要，便于快速核对。" className="lg:h-72" bodyClassName="flex min-h-0 flex-col">
              {overview.allowlist.length === 0 ? <EmptyState>当前 allowlist 为空。</EmptyState> : <div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="space-y-2">{overview.allowlist.map((node) => <div key={node} className="group relative rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-300"><span className="block truncate leading-5">{node}</span><div className="pointer-events-none absolute inset-x-3 bottom-full z-20 mb-2 hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg group-hover:block dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><span className="block break-all">{node}</span></div></div>)}</div></div>}
            </SectionCard>
            <SectionCard title="当前 Validators" description="展示当前链上的 QBFT Validator 地址集合。" className="lg:h-72" bodyClassName="flex min-h-0 flex-col">
              {overview.currentValidators.length === 0 ? <EmptyState>当前还没有读取到 Validator 列表。</EmptyState> : <div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="space-y-2">{overview.currentValidators.map((validatorAddress) => <div key={validatorAddress} className="group relative rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-300"><span className="block truncate font-mono leading-5">{validatorAddress}</span><div className="pointer-events-none absolute inset-x-3 bottom-full z-20 mb-2 hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg group-hover:block dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><span className="block break-all">{validatorAddress}</span></div></div>)}</div></div>}
            </SectionCard>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">最近成功审批数：{recentSuccessCount}。这个统计来自最新审批日志，用于快速确认后台动作是否持续生效。</div>
        </>
      ) : null}
    </main>
  );
}

function describeAction(action: AdminActionLogRecord["action"]) {
  switch (action) {
    case "node_request_approved": return "已批准节点申请";
    case "node_request_rejected": return "已拒绝节点申请";
    case "node_request_revoked": return "已撤销节点接入";
    case "validator_request_approved": return "已发起 Validator 加入投票";
    case "validator_request_rejected": return "已拒绝 Validator 申请";
    case "validator_removal_vote_proposed": return "已发起 Validator 移除投票";
    default: return action;
  }
}

function StatusTag({ status }: { status: NodeRequestRecord["status"] }) {
  const styles = status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : status === "revoked" ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" : status === "rejected" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  const label = status === "approved" ? "已批准" : status === "revoked" ? "已撤销" : status === "rejected" ? "已拒绝" : "待审批";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>{label}</span>;
}

function LifecyclePill({ label, value, tone }: { label: string; value: number; tone: "success" | "warn" | "danger" | "neutral" | "info" }) {
  const toneClass = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200" : tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200" : tone === "info" ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200" : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-200";
  return <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}><div className="text-xs font-medium">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="flex min-h-32 flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">{children}</div>;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
