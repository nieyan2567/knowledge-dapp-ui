"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { useUploadAuth } from "@/hooks/useUploadAuth";
import { ADMIN_COPY } from "@/lib/admin/copy";
import type {
  AdminRequestStatus,
  NodeJoinRequest,
  NodeJoinRequestInput,
  ValidatorJoinRequest,
  ValidatorJoinRequestInput,
} from "@/lib/admin/types";

type ModuleKind = "node" | "validator";
type RequestRecord = NodeJoinRequest | ValidatorJoinRequest;

type ModuleResponse<T extends RequestRecord> = {
  authenticated: boolean;
  isAdmin: boolean;
  address?: `0x${string}`;
  items: T[];
};

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function RequestStatusBadge({ status }: { status: AdminRequestStatus }) {
  const labelMap = {
    pending: ADMIN_COPY.common.reviewPending,
    approved: ADMIN_COPY.common.reviewApproved,
    rejected: ADMIN_COPY.common.reviewRejected,
  } as const;

  const classNameMap = {
    pending:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
    approved:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
    rejected:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
  } as const;

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classNameMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}

function RequestTable<T extends RequestRecord>({
  items,
  isAdmin,
  kind,
  reviewComment,
  onReviewCommentChange,
  onApprove,
  onReject,
}: {
  items: T[];
  isAdmin: boolean;
  kind: ModuleKind;
  reviewComment: Record<string, string>;
  onReviewCommentChange: (id: string, value: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {ADMIN_COPY.common.noRequests}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950/40">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3">{kind === "node" ? ADMIN_COPY.node.nodeName : ADMIN_COPY.validator.nodeName}</th>
              <th className="px-4 py-3">{kind === "node" ? ADMIN_COPY.node.serverIp : ADMIN_COPY.validator.serverIp}</th>
              <th className="px-4 py-3">{kind === "node" ? ADMIN_COPY.node.enode : ADMIN_COPY.validator.enode}</th>
              {kind === "validator" ? (
                <th className="px-4 py-3">{ADMIN_COPY.validator.validatorAddress}</th>
              ) : null}
              <th className="px-4 py-3">{ADMIN_COPY.common.applicant}</th>
              <th className="px-4 py-3">{ADMIN_COPY.common.status}</th>
              <th className="px-4 py-3">{ADMIN_COPY.common.createdAt}</th>
              {isAdmin ? <th className="px-4 py-3">{ADMIN_COPY.common.reviewActions}</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-4 font-medium text-slate-950 dark:text-slate-100">
                  {item.nodeName}
                </td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                  {item.serverIp}
                </td>
                <td className="max-w-sm px-4 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                  <div className="break-all">{item.enode}</div>
                </td>
                {kind === "validator" ? (
                  <td className="px-4 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                    {"validatorAddress" in item ? item.validatorAddress : "-"}
                  </td>
                ) : null}
                <td className="px-4 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                  {item.applicantAddress}
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-2">
                    <RequestStatusBadge status={item.status} />
                    {item.reviewComment ? (
                      <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
                        {item.reviewComment}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(item.createdAt)}
                </td>
                {isAdmin ? (
                  <td className="px-4 py-4">
                    {item.status === "pending" ? (
                      <div className="space-y-3">
                        <textarea
                          value={reviewComment[item.id] ?? ""}
                          onChange={(event) =>
                            onReviewCommentChange(item.id, event.target.value)
                          }
                          placeholder={ADMIN_COPY.common.reviewCommentPlaceholder}
                          className="min-h-20 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onApprove(item.id)}
                            className="inline-flex rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                          >
                            {ADMIN_COPY.common.approve}
                          </button>
                          <button
                            type="button"
                            onClick={() => onReject(item.id)}
                            className="inline-flex rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"
                          >
                            {ADMIN_COPY.common.reject}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                        <div>{ADMIN_COPY.common.reviewer}: {item.reviewedBy ?? "-"}</div>
                        <div>{ADMIN_COPY.common.updatedAt}: {item.reviewedAt ? formatDateTime(item.reviewedAt) : "-"}</div>
                      </div>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminRequestModule({ kind }: { kind: ModuleKind }) {
  const { ensureUploadAuth, isAuthenticating } = useUploadAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [address, setAddress] = useState<string | undefined>();
  const [items, setItems] = useState<RequestRecord[]>([]);
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});
  const [formState, setFormState] = useState({
    nodeName: "",
    serverIp: "",
    enode: "",
    validatorAddress: "",
  });

  const endpoint = kind === "node" ? "/api/admin/node-join-requests" : "/api/admin/validator-join-requests";
  const copy = kind === "node" ? ADMIN_COPY.node : ADMIN_COPY.validator;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = (await response.json()) as ModuleResponse<RequestRecord> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || ADMIN_COPY.common.loadFailed);
      }

      setAuthenticated(payload.authenticated);
      setIsAdmin(payload.isAdmin);
      setAddress(payload.address);
      setItems(payload.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : ADMIN_COPY.common.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFieldChange = useCallback(
    (key: keyof typeof formState, value: string) => {
      setFormState((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    const authenticatedNow = authenticated || (await ensureUploadAuth());
    if (!authenticatedNow) {
      return;
    }

    setSubmitting(true);
    try {
      const payload =
        kind === "node"
          ? ({
              nodeName: formState.nodeName.trim(),
              serverIp: formState.serverIp.trim(),
              enode: formState.enode.trim(),
            } satisfies NodeJoinRequestInput)
          : ({
              nodeName: formState.nodeName.trim(),
              serverIp: formState.serverIp.trim(),
              enode: formState.enode.trim(),
              validatorAddress:
                formState.validatorAddress.trim() as `0x${string}`,
            } satisfies ValidatorJoinRequestInput);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || ADMIN_COPY.common.submitFailed);
      }

      toast.success(ADMIN_COPY.common.submitSuccess);
      setFormState({
        nodeName: "",
        serverIp: "",
        enode: "",
        validatorAddress: "",
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : ADMIN_COPY.common.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }, [authenticated, endpoint, ensureUploadAuth, formState, kind, load]);

  const review = useCallback(
    async (id: string, action: "approve" | "reject") => {
      try {
        const response = await fetch(`${endpoint}/${id}/${action}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            reviewComment: reviewComment[id]?.trim() || undefined,
          }),
        });
        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(
            payload.error ||
              (action === "approve"
                ? ADMIN_COPY.common.approveFailed
                : ADMIN_COPY.common.rejectFailed)
          );
        }

        toast.success(
          action === "approve"
            ? ADMIN_COPY.common.approveSuccess
            : ADMIN_COPY.common.rejectSuccess
        );
        setReviewComment((current) => ({ ...current, [id]: "" }));
        await load();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : action === "approve"
              ? ADMIN_COPY.common.approveFailed
              : ADMIN_COPY.common.rejectFailed
        );
      }
    },
    [endpoint, load, reviewComment]
  );

  const headerRight = useMemo(
    () => (
      <button
        type="button"
        onClick={() => void load()}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {ADMIN_COPY.common.refresh}
      </button>
    ),
    [load, loading]
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        right={headerRight}
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 space-y-2">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
              {ADMIN_COPY.common.submit}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {authenticated
                ? `${ADMIN_COPY.common.signedInAs}: ${address}`
                : ADMIN_COPY.common.connectPrompt}
            </p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {copy.nodeName}
              </span>
              <input
                value={formState.nodeName}
                onChange={(event) => handleFieldChange("nodeName", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {copy.serverIp}
              </span>
              <input
                value={formState.serverIp}
                onChange={(event) => handleFieldChange("serverIp", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {copy.enode}
              </span>
              <textarea
                value={formState.enode}
                onChange={(event) => handleFieldChange("enode", event.target.value)}
                className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-xs text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            {kind === "validator" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {ADMIN_COPY.validator.validatorAddress}
                </span>
                <input
                  value={formState.validatorAddress}
                  onChange={(event) =>
                    handleFieldChange("validatorAddress", event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || isAuthenticating}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {submitting || isAuthenticating
                ? "处理中..."
                : ADMIN_COPY.common.submit}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                  {kind === "node"
                    ? ADMIN_COPY.dashboard.nodeTitle
                    : ADMIN_COPY.dashboard.validatorTitle}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {!authenticated
                    ? ADMIN_COPY.common.connectPrompt
                    : isAdmin
                      ? ADMIN_COPY.common.adminOnly
                      : ADMIN_COPY.common.viewerOnly}
                </p>
              </div>
              <Link
                href="/admin"
                className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-100"
              >
                返回管理首页
              </Link>
            </div>
          </div>

          <RequestTable
            items={items}
            isAdmin={isAdmin}
            kind={kind}
            reviewComment={reviewComment}
            onReviewCommentChange={(id, value) =>
              setReviewComment((current) => ({ ...current, [id]: value }))
            }
            onApprove={(id) => void review(id, "approve")}
            onReject={(id) => void review(id, "reject")}
          />
        </div>
      </section>
    </main>
  );
}
