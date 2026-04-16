/**
 * 模块说明：节点申请管理组件，负责提交节点申请、审批节点申请以及查看节点实时运行状态。
 */
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useUploadAuth } from "@/hooks/useUploadAuth";
import type { NodeRequestListResponse, NodeRequestRecord, NodeRequestRuntimeStatus } from "@/lib/admin/types";
import { PAGE_TEST_IDS } from "@/lib/test-ids";

type ReviewDraftState = Record<string, string>;
type RuntimeStatusMap = Record<string, NodeRequestRuntimeStatus | undefined>;
type LoadRequestsOptions = { background?: boolean };

const emptyCreateForm = { nodeName: "", serverHost: "", nodeRpcUrl: "", enode: "", description: "" };

/**
 * 渲染节点申请管理页面。
 * @returns 节点申请管理主组件。
 */
export function NodeRequestsAdminPage() {
  const { address } = useAccount();
  const { ensureUploadAuth, isAuthenticating } = useUploadAuth();
  const authAttemptedForAddress = useRef<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [currentAddress, setCurrentAddress] = useState<`0x${string}` | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<NodeRequestRecord[]>([]);
  const [runtimeStatuses, setRuntimeStatuses] = useState<RuntimeStatusMap>({});
  const [reviewDrafts, setReviewDrafts] = useState<ReviewDraftState>({});
  const [form, setForm] = useState(emptyCreateForm);

  /*
   * 这里先读取节点申请列表，再根据列表中的申请 ID 衍生实时状态查询。
   * 列表和运行状态分成两段请求，可以避免单次接口负担过重，也便于局部刷新。
   */
  const loadRequests = useCallback(async ({ background = false }: LoadRequestsOptions = {}) => {
    if (!background) setIsLoading(true);
    try {
      const response = await fetch("/api/admin/node-requests", { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json()) as NodeRequestListResponse | { error?: string };
      const errorMessage = "error" in data ? data.error : undefined;
      if (!response.ok || !("requests" in data)) throw new Error(errorMessage || "节点申请加载失败");
      const sessionMatchesWallet = !address || !data.currentAddress || data.currentAddress.toLowerCase() === address.toLowerCase();
      if (!sessionMatchesWallet) {
        setCurrentAddress(null);
        setIsAdmin(false);
        setRequests([]);
        setRuntimeStatuses({});
        toast.error("检测到钱包已切换，请重新完成签名验证。");
        return;
      }
      setCurrentAddress(data.currentAddress);
      setIsAdmin(data.isAdmin);
      setRequests(data.requests);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "节点申请加载失败");
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [address]);

  const loadRuntimeStatuses = useCallback(async (items: NodeRequestRecord[]) => {
    if (items.length === 0) {
      setRuntimeStatuses({});
      return;
    }
    const results = await Promise.all(items.map(async (request) => {
      try {
        const response = await fetch(`/api/admin/node-requests/${request.id}/status`, { cache: "no-store", credentials: "same-origin" });
        const data = (await response.json()) as NodeRequestRuntimeStatus | { error?: string };
        if (!response.ok || !("requestId" in data)) return [request.id, undefined] as const;
        return [request.id, data] as const;
      } catch {
        return [request.id, undefined] as const;
      }
    }));
    setRuntimeStatuses(Object.fromEntries(results));
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);
  useAutoRefresh({ enabled: !!currentAddress, onRefresh: () => loadRequests({ background: true }) });

  useEffect(() => {
    if (!address) { authAttemptedForAddress.current = null; return; }
    const normalizedAddress = address.toLowerCase();
    if (currentAddress || isAuthenticating || isLoading) return;
    if (authAttemptedForAddress.current === normalizedAddress) return;
    authAttemptedForAddress.current = normalizedAddress;
    void (async () => {
      const ok = await ensureUploadAuth();
      if (ok) await loadRequests({ background: requests.length > 0 });
    })();
  }, [address, currentAddress, ensureUploadAuth, isAuthenticating, isLoading, loadRequests, requests.length]);

  useEffect(() => { void loadRuntimeStatuses(requests); }, [requests, loadRuntimeStatuses]);

  useEffect(() => {
    if (!isGuideOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsGuideOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isGuideOpen]);

  const pendingCount = useMemo(() => requests.filter((request) => request.status === "pending").length, [requests]);

  async function ensureSessionOrThrow() {
    const ok = await ensureUploadAuth();
    if (!ok) throw new Error("请先完成钱包签名验证。");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address) { toast.error("请先连接钱包。"); return; }
    setIsSubmitting(true);
    try {
      await ensureSessionOrThrow();
      const response = await fetch("/api/admin/node-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as NodeRequestRecord | { error?: string };
      const errorMessage = "error" in data ? data.error : undefined;
      if (!response.ok || !("id" in data)) throw new Error(errorMessage || "节点申请提交失败");
      toast.success("节点申请已提交。");
      setForm(emptyCreateForm);
      await loadRequests({ background: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "节点申请提交失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReview(requestId: string, action: "approve" | "reject") {
    setActiveActionId(requestId);
    try {
      await ensureSessionOrThrow();
      const response = await fetch(`/api/admin/node-requests/${requestId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reviewComment: reviewDrafts[requestId] || "" }),
      });
      const data = (await response.json()) as NodeRequestRecord | { error?: string };
      const errorMessage = "error" in data ? data.error : undefined;
      if (!response.ok || !("id" in data)) throw new Error(errorMessage || "节点申请审批失败");
      toast.success(action === "approve" ? "节点申请已批准。" : "节点申请已拒绝。");
      setReviewDrafts((current) => ({ ...current, [requestId]: "" }));
      await loadRequests({ background: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "节点申请审批失败");
    } finally {
      setActiveActionId(null);
    }
  }

  async function handleRevoke(requestId: string) {
    setActiveActionId(requestId);
    try {
      await ensureSessionOrThrow();
      const response = await fetch(`/api/admin/node-requests/${requestId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reviewComment: reviewDrafts[requestId] || "" }),
      });
      const data = (await response.json()) as NodeRequestRecord | { error?: string };
      const errorMessage = "error" in data ? data.error : undefined;
      if (!response.ok || !("id" in data)) throw new Error(errorMessage || "节点撤销失败");
      toast.success("节点已撤销，并已从 allowlist 中移除。");
      setReviewDrafts((current) => ({ ...current, [requestId]: "" }));
      await loadRequests({ background: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "节点撤销失败");
    } finally {
      setActiveActionId(null);
    }
  }

  return (
    <>
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <PageHeader
          eyebrow="Admin / Node Access"
          title="Node Management"
          description="用户可以提交节点申请、跟踪审批状态，并在批准后查看该节点是否已加入 allowlist 以及运行情况。"
          testId={PAGE_TEST_IDS.admin}
          right={<div className="flex flex-wrap gap-3"><Link href="/admin" className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">返回概览</Link></div>}
        />
        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
          <div className="space-y-6">
            <SectionCard
              title="节点申请"
              description="请提供足够的信息，方便审批并在批准后继续检查 allowlist 与节点运行状态。"
              bodyClassName="space-y-4"
              headerRight={<div className="group relative"><span className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">How To Get The Inputs</span><button type="button" aria-label="打开参数获取说明" onClick={() => setIsGuideOpen(true)} className="inline-flex size-9 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">?</button></div>}
            >
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">如果你是第一次部署节点，建议先按<Link href="/admin/nodes/onboarding" className="mx-1 font-semibold underline underline-offset-2">首次接入指南</Link>把服务器、Docker 和 Besu 节点准备好，再回到这里提交申请。</div>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <Field label="节点名称" value={form.nodeName} onChange={(value) => setForm((current) => ({ ...current, nodeName: value }))} placeholder="Singapore Full Node A" />
                <Field label="服务器地址" value={form.serverHost} onChange={(value) => setForm((current) => ({ ...current, serverHost: value }))} placeholder="node-a.example.com 或 10.0.1.15" />
                <Field label="节点 RPC 地址" value={form.nodeRpcUrl} onChange={(value) => setForm((current) => ({ ...current, nodeRpcUrl: value }))} placeholder="http://10.0.1.15:8545" />
                <Field label="Enode" value={form.enode} onChange={(value) => setForm((current) => ({ ...current, enode: value }))} placeholder="enode://..." />
                <TextAreaField label="说明" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} placeholder="填写节点角色、部署地区、同步情况或其他补充说明" />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">当前钱包：{address || "未连接"}。{currentAddress ? " 服务端会话已验证。" : isAuthenticating ? " 页面正在自动发起签名验证。" : " 进入页面后会自动发起签名验证；如果你取消了签名，重新进入页面或重新连接钱包后会再次触发。"}</div>
                <button type="submit" disabled={isSubmitting || isAuthenticating} className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">{isSubmitting || isAuthenticating ? "提交中..." : "提交申请"}</button>
              </form>
            </SectionCard>
          </div>
          <SectionCard title={isAdmin ? "审批队列" : "我的申请与运行状态"} description={isAdmin ? `当前还有 ${pendingCount} 条申请待审批。` : "每条申请都会显示审批状态、allowlist 状态和基础运行检查结果。"} className="xl:h-192" bodyClassName="flex min-h-0 flex-col">
            {isLoading ? <EmptyState>正在加载节点申请...</EmptyState> : requests.length === 0 ? <EmptyState>{isAdmin ? "暂时还没有节点申请。" : "你还没有提交任何节点申请。"}</EmptyState> : <div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="space-y-4">{requests.map((request) => {
              const isPending = request.status === "pending";
              const isApproved = request.status === "approved";
              const isActive = activeActionId === request.id;
              const runtimeStatus = runtimeStatuses[request.id];
              const nextStep = buildNextStepMessage(request, runtimeStatus);
              return (
                <article key={request.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">{request.nodeName}</h3><StatusBadge status={request.status} /></div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">申请人：{request.applicantAddress}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">主机：{request.serverHost}</p>
                      {request.nodeRpcUrl ? <p className="break-all text-sm text-slate-600 dark:text-slate-300">节点 RPC：{request.nodeRpcUrl}</p> : null}
                      <p className="break-all text-sm text-slate-600 dark:text-slate-300">Enode：{request.enode}</p>
                      {request.description ? <p className="text-sm text-slate-600 dark:text-slate-300">说明：{request.description}</p> : null}
                      <p className="text-xs text-slate-500 dark:text-slate-400">创建时间：{formatDateTime(request.createTime)}</p>
                      {request.reviewedBy ? <p className="text-xs text-slate-500 dark:text-slate-400">审批人：{request.reviewedBy}{request.reviewComment ? ` / 备注：${request.reviewComment}` : ""}</p> : null}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusPill label="白名单" value={request.status === "approved" ? runtimeStatus ? runtimeStatus.isAllowlisted ? "已加入" : "未发现" : "检查中" : "待审批"} tone={request.status === "approved" && runtimeStatus?.isAllowlisted ? "success" : request.status === "approved" ? "warn" : "neutral"} />
                        <StatusPill label="节点健康" value={runtimeStatus ? formatHealthStage(runtimeStatus.health.stage) : "检查中"} tone={mapHealthTone(runtimeStatus?.health.stage)} />
                        {runtimeStatus && runtimeStatus.health.peerCount !== null ? <StatusPill label="对等节点" value={String(runtimeStatus.health.peerCount)} tone="neutral" /> : null}
                      </div>
                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{nextStep}</p>
                      {runtimeStatus?.allowlistError ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">白名单检查错误：{runtimeStatus.allowlistError}</p> : null}
                      {runtimeStatus?.health.detail ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">运行状态详情：{runtimeStatus.health.detail}</p> : null}
                    </div>
                    {isAdmin && isPending ? <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700"><TextAreaField label="审批备注" value={reviewDrafts[request.id] || ""} onChange={(value) => setReviewDrafts((current) => ({ ...current, [request.id]: value }))} placeholder="可选的内部审批备注" /><div className="flex flex-wrap gap-3"><button type="button" disabled={isActive} onClick={() => void handleReview(request.id, "approve")} className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">{isActive ? "处理中..." : "批准并加入 Allowlist"}</button><button type="button" disabled={isActive} onClick={() => void handleReview(request.id, "reject")} className="inline-flex items-center rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/20">拒绝</button></div></div> : null}
                    {isAdmin && isApproved ? <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700"><TextAreaField label="撤销备注" value={reviewDrafts[request.id] || ""} onChange={(value) => setReviewDrafts((current) => ({ ...current, [request.id]: value }))} placeholder="可选的节点下线或撤销说明" /><button type="button" disabled={isActive} onClick={() => void handleRevoke(request.id)} className="inline-flex items-center rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/20">{isActive ? "处理中..." : "撤销并移出 Allowlist"}</button></div> : null}
                  </div>
                </article>
              );
            })}</div></div>}
          </SectionCard>
        </div>
      </main>
      {isGuideOpen ? <GuideModal onClose={() => setIsGuideOpen(false)} /> : null}
    </>
  );
}

/**
 * 根据节点申请与运行状态推导下一步提示文案。
 * @param request 节点申请记录。
 * @param runtimeStatus 节点实时运行状态。
 * @returns 面向用户的下一步操作提示。
 */
function buildNextStepMessage(request: NodeRequestRecord, runtimeStatus?: NodeRequestRuntimeStatus) {
  if (request.status === "pending") return "申请已提交，请等待管理员审批后再让该节点承载正式网络流量。";
  if (request.status === "rejected") return request.reviewComment ? `申请已被拒绝。审批备注：${request.reviewComment}` : "申请已被拒绝。请完善节点信息后重新提交。";
  if (request.status === "revoked") return request.reviewComment ? `节点接入已撤销。备注：${request.reviewComment}` : "节点接入已撤销，该 enode 已从 allowlist 中移除。";
  if (!runtimeStatus) return "申请已批准，系统正在检查 allowlist 和节点运行状态。";
  if (!runtimeStatus.isAllowlisted) return "申请虽然已批准，但当前还没有在 Besu allowlist 中看到该 enode。请检查 permissioning 配置或重新加载 allowlist。";
  switch (runtimeStatus.health.stage) {
    case "not_configured": return "该 enode 已加入 allowlist。如果你希望在页面中继续看到 peer count 和同步进度，请补充节点 RPC 地址。";
    case "unreachable": return "该 enode 已加入 allowlist，但服务端无法访问你提供的节点 RPC 地址。请检查防火墙和 RPC 暴露设置。";
    case "enode_mismatch": return "节点 RPC 可以访问，但返回的 enode 与已批准申请不一致。请核对节点身份配置后再继续。";
    case "waiting_for_peers": return "该 enode 已加入 allowlist，节点 RPC 也可访问，但当前仍然没有连接到任何 peer。请检查网络连通性和 bootnodes 配置。";
    case "syncing": return "该 enode 已加入 allowlist，节点正在同步。建议同步完成后再提交 Validator 申请。";
    case "healthy": return "节点已加入 allowlist，已连接网络并运行正常。此时继续进入 Validator 接入流程会更合适。";
  }
}

/**
 * 格式化节点健康阶段。
 * @param stage 健康检查阶段值。
 * @returns 健康阶段显示文案。
 */
function formatHealthStage(stage: NodeRequestRuntimeStatus["health"]["stage"]) {
  switch (stage) {
    case "not_configured": return "未填写 RPC";
    case "unreachable": return "不可达";
    case "enode_mismatch": return "Enode 不匹配";
    case "waiting_for_peers": return "等待连接";
    case "syncing": return "同步中";
    case "healthy": return "健康";
  }
}

/**
 * 把节点健康阶段映射成语义颜色。
 * @param stage 健康检查阶段值。
 * @returns 适合状态胶囊使用的语义色调。
 */
function mapHealthTone(stage?: NodeRequestRuntimeStatus["health"]["stage"]) {
  switch (stage) {
    case "healthy": return "success";
    case "syncing":
    case "waiting_for_peers": return "warn";
    case "unreachable":
    case "enode_mismatch": return "danger";
    default: return "neutral";
  }
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-200" /></label>;
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-200" /></label>;
}

function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <button type="button" aria-label="关闭说明弹窗" onClick={onClose} className="absolute inset-0" />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">参数获取说明</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">这里整理了普通节点申请最常用的参数获取方式。如果你是首次部署节点，建议优先阅读首次接入指南。</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-full border border-slate-300 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">×</button>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">如果你还没有服务器、Docker 或 Besu 节点，请先查看<Link href="/admin/nodes/onboarding" className="mx-1 font-semibold underline underline-offset-2" onClick={onClose}>首次接入指南</Link>。</div>
          <GuideBlock title="从 Besu 容器日志获取 enode" command={`docker logs <your-besu-container> 2>&1 | grep -i "Enode URL"`} description="日志里会包含完整 enode。如果该节点需要被其他对等节点访问，请使用对外可达地址，不要填写 127.0.0.1。" />
          <GuideBlock title="通过本地 RPC 获取 enode" command={`curl -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}'`} description="如果节点开放了 ADMIN API，返回结果里会包含 enode 字段。运行状态检查也会用这个值判断节点身份是否一致。" />
          <GuideBlock title="检查节点是否已经连入网络" command={`curl -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'`} description="当 peer count 大于 0 时，通常表示节点已经开始连入网络。" />
          <GuideBlock title="检查节点是否仍在同步" command={`curl -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}'`} description="如果你希望在页面中持续查看同步状态，请在申请时填写节点 RPC 地址。" />
        </div>
      </div>
    </div>
  );
}

function GuideBlock({ title, description, command }: { title: string; description: string; command: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      toast.success("命令已复制。");
    } catch {
      toast.error("复制失败，请手动复制。");
    }
  }

  return (
    <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</summary>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{description}</p>
      <div className="group mt-3 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start gap-3">
          <pre className="min-w-0 flex-1 overflow-x-auto text-xs text-slate-700 dark:text-slate-200"><code>{command}</code></pre>
          <button type="button" title="复制命令" aria-label="复制命令" onClick={() => void handleCopy()} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 opacity-0 transition hover:bg-slate-50 hover:text-slate-900 group-hover:opacity-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-950 dark:hover:text-slate-100">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4" aria-hidden="true">
              <rect x="7" y="3" width="10" height="12" rx="2" />
              <path d="M5 7H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" />
            </svg>
          </button>
        </div>
      </div>
    </details>
  );
}

function StatusBadge({ status }: { status: NodeRequestRecord["status"] }) {
  const styles = status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : status === "revoked" ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" : status === "rejected" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  const label = status === "approved" ? "已批准" : status === "revoked" ? "已撤销" : status === "rejected" ? "已拒绝" : "待审批";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>{label}</span>;
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: "success" | "warn" | "danger" | "neutral" }) {
  const toneClass = tone === "success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : tone === "warn" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : tone === "danger" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}>{label}: {value}</span>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="flex min-h-44 flex-1 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">{children}</div>;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
