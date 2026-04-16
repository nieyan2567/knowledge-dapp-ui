"use client";

/**
 * @notice 浏览器端错误上报工具。
 * @dev 负责去重、清洗上下文并将客户端错误发送到服务端观测接口。
 */
import {
  sanitizeContext,
  serializeError,
  type ClientErrorReport,
  type ObservabilityContext,
  type ObservabilitySeverity,
  type ObservabilityTags,
} from "@/lib/observability/shared";

/**
 * @notice 客户端错误捕获输入结构。
 * @dev 在共享上报结构的基础上保留原始错误对象，便于本地序列化。
 */
type ClientCaptureInput = {
  message: string;
  source: string;
  severity?: ObservabilitySeverity;
  handled?: boolean;
  fingerprint?: string;
  tags?: ObservabilityTags;
  context?: ObservabilityContext;
  error?: unknown;
};

const dedupStore = new Map<string, number>();
const dedupWindowMs = 5_000;

function createClientFingerprint(input: ClientCaptureInput) {
  return (
    input.fingerprint ??
    `${input.source}:${input.message}:${window.location.pathname}`
  );
}

/**
 * @notice 上报一条客户端错误事件。
 * @param input 错误上报输入参数。
 * @returns 当前函数不返回业务数据；若环境不支持则直接静默退出。
 */
export async function reportClientError(input: ClientCaptureInput) {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return;
  }

  /**
   * @notice 基于指纹在短时间窗口内做去重。
   * @dev 避免同一错误在组件重复渲染时被密集上报。
   */
  const fingerprint = createClientFingerprint(input);
  const now = Date.now();
  const previous = dedupStore.get(fingerprint);

  if (previous && now - previous < dedupWindowMs) {
    return;
  }

  dedupStore.set(fingerprint, now);

  const payload: ClientErrorReport = {
    message: input.message,
    source: input.source,
    severity: input.severity,
    handled: input.handled,
    fingerprint,
    tags: input.tags,
    context: input.context
      ? (sanitizeContext(input.context) as ObservabilityContext)
      : undefined,
    error: serializeError(input.error),
    pathname: window.location.pathname,
    url: window.location.href,
    userAgent: window.navigator.userAgent,
    occurredAt: new Date().toISOString(),
  };

  try {
    await fetch("/api/observability/client-error", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "same-origin",
    });
  } catch {
    /**
     * @notice 客户端遥测传输失败时选择静默吞掉异常。
     * @dev 避免观测系统不可用反向影响用户主流程。
     */
  }
}
