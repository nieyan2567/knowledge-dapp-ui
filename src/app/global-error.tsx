"use client";

/**
 * 模块说明：提供应用级全局错误边界页面，在根布局或初始化阶段失败时兜底整个文档。
 */
import { useEffect } from "react";

import { reportClientError } from "@/lib/observability/client";

/**
 * 渲染应用级致命错误的回退界面。
 * @param error 根应用树抛出的致命错误对象。
 * @param reset Next.js 提供的重试回调，用于重新尝试初始化应用。
 * @returns 包含完整 `html` 与 `body` 结构的全局错误页面。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 全局错误通常意味着根布局或初始化链路失败，需要以更高严重级别记录。
    void reportClientError({
      message: "Next.js global error boundary triggered",
      source: "app.global-error",
      severity: "fatal",
      handled: false,
      error,
      context: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
              全局错误
            </div>
            <h1 className="mt-3 text-3xl font-semibold">
              应用暂时无法正常加载
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              这说明错误已经影响到全局布局或基础初始化。你可以先尝试重新加载应用。
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                重试
              </button>
              <button
                type="button"
                onClick={() => window.location.assign("/")}
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                返回首页
              </button>
            </div>

            {error.digest ? (
              <div className="mt-6 text-xs text-slate-400 dark:text-slate-500">
                错误标识：{error.digest}
              </div>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  );
}
