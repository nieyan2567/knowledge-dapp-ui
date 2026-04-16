"use client";

/**
 * 模块说明：前端观测 Provider，负责把浏览器级未捕获异常和 Promise 拒绝接入统一上报链路。
 */
import { useEffect } from "react";

import { reportClientError } from "@/lib/observability/client";

/**
 * 注册浏览器全局错误监听器。
 * @returns 不渲染可见 UI，仅负责副作用注册。
 */
export function ObservabilityProvider() {
  useEffect(() => {
    /*
     * 这里监听 window.error 和 unhandledrejection，
     * 用来补齐 React 组件树之外的浏览器级异常采集。
     */
    function handleError(event: ErrorEvent) {
      void reportClientError({
        message: event.message || "Unhandled window error",
        source: "window.error",
        severity: "error",
        handled: false,
        error: event.error,
        context: {
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
        },
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      void reportClientError({
        message: "Unhandled promise rejection",
        source: "window.unhandledrejection",
        severity: "error",
        handled: false,
        error: event.reason,
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
