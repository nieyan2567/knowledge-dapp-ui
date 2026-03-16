"use client";

import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function isHttpUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

export function CopyField({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(value);
            toast.success("已复制到剪贴板");
        } catch {
            toast.error("复制失败");
        }
    }

    const isLink = isHttpUrl(value);

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </div>

            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1 break-all text-sm font-medium text-slate-800 dark:text-slate-200">
                    {isLink ? (
                        <a
                            href={value}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 underline-offset-2 hover:underline"
                            title={value}
                        >
                            <span className="break-all">{value}</span>
                            <ExternalLink className="h-4 w-4 shrink-0" />
                        </a>
                    ) : (
                        value
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    title="复制"
                >
                    <Copy className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                </button>
            </div>
        </div>
    );
}
