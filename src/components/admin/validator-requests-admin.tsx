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
import type { NodeRequestRecord, ValidatorRequestListResponse, ValidatorRequestRecord } from "@/lib/admin/types";

type ReviewDraftState = Record<string, string>;
type LoadValidatorRequestsOptions = { background?: boolean; silent?: boolean };

const emptyCreateForm = { nodeRequestId: "", validatorAddress: "", description: "" };

export function ValidatorRequestsAdminPage() {
  const { address } = useAccount();
  const { ensureUploadAuth, isAuthenticating } = useUploadAuth();
  const authAttemptedForAddress = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [currentAddress, setCurrentAddress] = useState<`0x${string}` | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<ValidatorRequestRecord[]>([]);
  const [eligibleNodes, setEligibleNodes] = useState<NodeRequestRecord[]>([]);
  const [eligibleNodesError, setEligibleNodesError] = useState<string | null>(null);
  const [currentValidators, setCurrentValidators] = useState<`0x${string}`[]>([]);
  const [validatorsError, setValidatorsError] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<ReviewDraftState>({});
  const [form, setForm] = useState(emptyCreateForm);

  const loadRequests = useCallback(async ({ background = false, silent = false }: LoadValidatorRequestsOptions = {}) => {
    if (!background) setIsLoading(true);
    try {
      const response = await fetch("/api/admin/validator-requests", { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json()) as ValidatorRequestListResponse | { error?: string };
      const errorMessage = "error" in data ? data.error : undefined;
      if (!response.ok || !("requests" in data)) throw new Error(errorMessage || "Validator 申请加载失败");

      const sessionMatchesWallet = !address || !data.currentAddress || data.currentAddress.toLowerCase() === address.toLowerCase();
      if (!sessionMatchesWallet) {
        setCurrentAddress(null);
        setIsAdmin(false);
        setRequests([]);
        setEligibleNodes([]);
        setEligibleNodesError(null);
        setCurrentValidators([]);
        setValidatorsError(null);
        if (!silent) toast.error("检测到钱包已切换，请重新完成签名验证。");
        return;
      }

      setCurrentAddress(data.currentAddress);
      setIsAdmin(data.isAdmin);
      setRequests(data.requests);
      setEligibleNodes(data.eligibleNodes);
      setEligibleNodesError(data.eligibleNodesError);
      setCurrentValidators(data.currentValidators);
      setValidatorsError(data.validatorsError);
      setForm((current) => current.nodeRequestId || data.eligibleNodes.length === 0 ? current : { ...current, nodeRequestId: data.eligibleNodes[0].id });
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "Validator 申请加载失败");
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [address]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);
  useAutoRefresh({ enabled: !!currentAddress, onRefresh: () => loadRequests({ background: true, silent: true }) });

  useEffect(() => {
    if (!address) { authAttemptedForAddress.current = null; return; }
    const normalizedAddress = address.toLowerCase();
    if (currentAddress || isAuthenticating || isLoading) return;
    if (authAttemptedForAddress.current === normalizedAddress) return;
    authAttemptedForAddress.current = normalizedAddress;
    void (async () => {
      const ok = await ensureUploadAuth();
      if (ok) await loadRequests({ background: requests.length > 0, silent: true });
    })();
  }, [address, currentAddress, ensureUploadAuth, isAuthenticating, isLoading, loadRequests, requests.length]);

  const pendingCount = useMemo(() => requests.filter((request) => request.status === "pending").length, [requests]);
  const currentValidatorSet = useMemo(() => new Set(currentValidators.map((validator) => validator.toLowerCase())), [currentValidators]);

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
      const response = await fetch("/api/admin/validator-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as ValidatorRequestRecord | { error?: string };
      const errorMessage = "error" in data ? data.error : undefined;
      if (!response.ok || !("id" in data)) throw new Error(errorMessage || "Validator 申请提交失败");
      toast.success("Validator 申请已提交。");
      setForm((current) => ({ ...emptyCreateForm, nodeRequestId: current.nodeRequestId }));
      await loadRequests({ background: true, silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Validator 申请提交失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReview(requestId: string, action: "approve" | "reject") {
    setActiveActionId(requestId);
    try {
      await ensureSessionOrThrow();
      const response = await fetch(`/api/admin/validator-requests/${requestId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reviewComment: reviewDrafts[requestId] || "" }),
      });
      const data = (await response.json()) as ValidatorRequestRecord | { error?: string };
      const errorMessage = "error" in data ? data.error : undefined;
      if (!response.ok || !("id" in data)) throw new Error(errorMessage || "Validator 申请审批失败");
      toast.success(action === "approve" ? "Validator 加入投票已发起。" : "Validator 申请已拒绝。");
      setReviewDrafts((current) => ({ ...current, [requestId]: "" }));
      await loadRequests({ background: true, silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Validator 申请审批失败");
    } finally {
      setActiveActionId(null);
    }
  }

  async function handleRemoveValidator(requestId: string) {
    setActiveActionId(requestId);
    try {
      await ensureSessionOrThrow();
      const response = await fetch(`/api/admin/validator-requests/${requestId}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reviewComment: reviewDrafts[requestId] || "" }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Validator 移除投票发起失败");
      toast.success("Validator 移除投票已发起。");
      setReviewDrafts((current) => ({ ...current, [requestId]: "" }));
      await loadRequests({ background: true, silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Validator 移除投票发起失败");
    } finally {
      setActiveActionId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Admin / Validators"
        title="Validator Reviews"
        description="基于已批准的普通节点提交 Validator 申请，管理员审批后由服务端发起 QBFT Validator 投票。"
        right={<div className="flex flex-wrap gap-3"><Link href="/admin" className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">返回概览</Link><Link href="/admin/nodes" className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">查看节点管理</Link></div>}
      />

      <div className="grid gap-6 xl:grid-cols-[1.02fr_1.38fr]">
        <div className="space-y-6">
          <SectionCard title="Validator 申请" description="只能基于已经批准且仍在 allowlist 中的普通节点提交 Validator 申请。" bodyClassName="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">当前钱包：{address || "未连接"}。{currentAddress ? " 服务端会话已验证。" : isAuthenticating ? " 页面正在自动发起签名验证。" : " 进入页面后会自动发起签名验证；如果你取消了签名，重新进入页面或重新连接钱包后会再次触发。"}</div>
            {eligibleNodesError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">可申请节点列表读取失败：{eligibleNodesError}</div> : null}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">已批准的普通节点</span>
                <select value={form.nodeRequestId} onChange={(event) => setForm((current) => ({ ...current, nodeRequestId: event.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-200">
                  {eligibleNodes.length === 0 ? <option value="">{eligibleNodesError ? "当前无法读取可申请节点" : "当前没有仍在 allowlist 中的已批准节点"}</option> : null}
                  {eligibleNodes.map((node) => <option key={node.id} value={node.id}>{node.nodeName} / {node.serverHost}</option>)}
                </select>
              </label>
              <Field label="Validator Address" value={form.validatorAddress} onChange={(value) => setForm((current) => ({ ...current, validatorAddress: value }))} placeholder="0x..." />
              <TextAreaField label="说明" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} placeholder="填写 Validator 角色说明、节点同步情况或其他补充说明" />
              <button type="submit" disabled={isSubmitting || isAuthenticating || eligibleNodes.length === 0 || !form.nodeRequestId} className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">{isSubmitting || isAuthenticating ? "提交中..." : "提交 Validator 申请"}</button>
            </form>
          </SectionCard>

          <SectionCard title="Current Validators" description="当前 QBFT Validator 集合。审批后这里会反映当前链上的最终状态。" className="xl:h-96" bodyClassName="flex min-h-0 flex-col">
            {validatorsError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">当前 Validator 列表读取失败：{validatorsError}</div> : currentValidators.length === 0 ? <EmptyState>当前还没有读取到 Validator 列表。</EmptyState> : <div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="space-y-2">{currentValidators.map((validatorAddress) => <div key={validatorAddress} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-200"><span className="block break-all font-mono">{validatorAddress}</span></div>)}</div></div>}
          </SectionCard>
        </div>

        <SectionCard title={isAdmin ? "审批队列" : "我的 Validator 申请"} description={isAdmin ? `当前还有 ${pendingCount} 条 Validator 申请待审批。` : "提交后可以在这里查看审批状态、投票进度和链上结果。"} className="xl:h-192" bodyClassName="flex min-h-0 flex-col">
          {isLoading ? <EmptyState>正在加载 Validator 申请...</EmptyState> : requests.length === 0 ? <EmptyState>{isAdmin ? "暂时还没有 Validator 申请。" : "你还没有提交任何 Validator 申请。"}</EmptyState> : <div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="space-y-4">{requests.map((request) => {
            const isPending = request.status === "pending";
            const isActive = activeActionId === request.id;
            const isInCurrentValidatorSet = currentValidatorSet.has(request.validatorAddress.toLowerCase());
            const lifecycle = getValidatorLifecycle(request, isInCurrentValidatorSet);
            return (
              <article key={request.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">{request.nodeName}</h3>
                      <StatusBadge status={request.status} />
                      <LifecycleBadge label={lifecycle.label} tone={lifecycle.tone} />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">申请人：{request.applicantAddress}</p>
                    <p className="break-all text-sm text-slate-600 dark:text-slate-300">Node Enode：{request.nodeEnode}</p>
                    <p className="break-all text-sm text-slate-600 dark:text-slate-300">Validator Address：{request.validatorAddress}</p>
                    {request.description ? <p className="text-sm text-slate-600 dark:text-slate-300">说明：{request.description}</p> : null}
                    <p className="text-xs text-slate-500 dark:text-slate-400">创建时间：{formatDateTime(request.createTime)}</p>
                    {request.reviewedBy ? <p className="text-xs text-slate-500 dark:text-slate-400">审批人：{request.reviewedBy}{request.reviewComment ? ` / 备注：${request.reviewComment}` : ""}</p> : null}
                    {request.removalVoteProposedAt ? <p className="text-xs text-slate-500 dark:text-slate-400">最近一次移除投票：{formatDateTime(request.removalVoteProposedAt)}</p> : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                    <div className="font-medium text-slate-900 dark:text-slate-100">当前阶段：{lifecycle.label}</div>
                    <p className="mt-2">{lifecycle.description}</p>
                  </div>

                  {isAdmin && isPending ? <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700"><TextAreaField label="审批备注" value={reviewDrafts[request.id] || ""} onChange={(value) => setReviewDrafts((current) => ({ ...current, [request.id]: value }))} placeholder="可选的内部审批备注" /><div className="flex flex-wrap gap-3"><button type="button" disabled={isActive} onClick={() => void handleReview(request.id, "approve")} className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">{isActive ? "处理中..." : "批准并发起投票"}</button><button type="button" disabled={isActive} onClick={() => void handleReview(request.id, "reject")} className="inline-flex items-center rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/20">拒绝</button></div></div> : null}

                  {isAdmin && request.status === "approved" && isInCurrentValidatorSet ? <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700"><TextAreaField label="移除备注" value={reviewDrafts[request.id] || ""} onChange={(value) => setReviewDrafts((current) => ({ ...current, [request.id]: value }))} placeholder="可选的 Validator 移除说明" /><button type="button" disabled={isActive} onClick={() => void handleRemoveValidator(request.id)} className="inline-flex items-center rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/20">{isActive ? "处理中..." : "发起移除投票"}</button></div> : null}
                </div>
              </article>
            );
          })}</div></div>}
        </SectionCard>
      </div>
    </main>
  );
}

function getValidatorLifecycle(request: ValidatorRequestRecord, isInCurrentValidatorSet: boolean) {
  if (request.status === "pending") {
    return { label: "等待审批", description: "申请已提交，等待管理员审批。批准后服务端会发起 QBFT 加入投票。", tone: "warn" as const };
  }
  if (request.status === "rejected") {
    return { label: "申请已拒绝", description: request.reviewComment ? `申请已被拒绝。备注：${request.reviewComment}` : "申请已被拒绝，请检查普通节点状态、Validator 地址和提交信息。", tone: "danger" as const };
  }
  if (request.removalVoteProposedAt && isInCurrentValidatorSet) {
    return { label: "已发起移除投票", description: "该地址当前仍在 Validator 集合中，但管理员已经发起移除投票，最终结果取决于现有 Validator 的投票多数。", tone: "danger" as const };
  }
  if (request.removalVoteProposedAt && !isInCurrentValidatorSet) {
    return { label: "已移出集合", description: "此前已发起移除投票，当前该地址已经不在 Validator 集合中。", tone: "neutral" as const };
  }
  if (isInCurrentValidatorSet) {
    return { label: "已进入集合", description: "加入投票已经生效，该地址当前已在链上 Validator 集合中。", tone: "info" as const };
  }
  return { label: "已发起加入投票", description: "管理员已经发起加入投票，但该地址当前还未进入 Validator 集合，需要等待现有 Validator 完成投票。", tone: "success" as const };
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-200" /></label>;
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-200" /></label>;
}

function StatusBadge({ status }: { status: ValidatorRequestRecord["status"] }) {
  const styles = status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : status === "rejected" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  const label = status === "approved" ? "已批准" : status === "rejected" ? "已拒绝" : "待审批";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>{label}</span>;
}

function LifecycleBadge({ label, tone }: { label: string; tone: "success" | "warn" | "danger" | "neutral" | "info" }) {
  const styles = tone === "success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : tone === "warn" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : tone === "danger" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : tone === "info" ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>{label}</span>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="flex min-h-44 flex-1 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">{children}</div>;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
