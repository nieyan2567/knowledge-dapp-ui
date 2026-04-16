"use client";

/**
 * 模块说明：提供路由段级别的错误边界页面，在局部渲染失败时保留应用外壳并允许用户重试。
 */
import Link from "next/link";
import { useEffect } from "react";

import { reportClientError } from "@/lib/observability/client";

/**
 * 渲染当前路由段的错误边界回退界面。
 * @param error 当前路由段抛出的错误对象。
 * @param reset Next.js 提供的重试回调，用于重新加载当前路由段。
 * @returns 当前页面可恢复的错误提示界面。
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 这里把路由段错误上报到前端观测链路，便于把页面崩溃和具体路由关联起来。
    void reportClientError({
      message: "Next.js segment error boundary triggered",
      source: "app.error",
      severity: "error",
      handled: false,
      error,
      context: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          页面加载失败
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-100">
          当前页面发生错误
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          这通常是临时问题。你可以先重试当前页面，如果仍然失败，再返回首页继续使用其他功能。
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            重新加载
          </button>
          <Link
            href="/"
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            返回首页
          </Link>
        </div>

        {error.digest ? (
          <div className="mt-6 text-xs text-slate-400 dark:text-slate-500">
            错误标识：{error.digest}
          </div>
        ) : null}
      </div>
    </main>
  );
}
