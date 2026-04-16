/**
 * @file 服务端观测模块。
 * @description 负责服务端日志采集、异常上报、告警分发和客户端错误落库入口。
 */
import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env";
import {
  isSeverityAtLeast,
  normalizeSeverity,
  sanitizeContext,
  serializeError,
  type ClientErrorReport,
  type ObservabilityContext,
  type ObservabilitySeverity,
  type ObservabilityTags,
  type RequestContext,
} from "@/lib/observability/shared";

/**
 * @notice 标准化后的服务端日志记录结构。
 */
type ServerLogEntry = {
  eventId: string;
  timestamp: string;
  service: string;
  deployment: string;
  severity: ObservabilitySeverity;
  source: string;
  message: string;
  tags?: ObservabilityTags;
  context?: ObservabilityContext;
  request?: RequestContext;
  error?: ReturnType<typeof serializeError>;
};

/**
 * @notice 服务端事件采集输入结构。
 */
type ServerCaptureInput = {
  message: string;
  source: string;
  severity?: ObservabilitySeverity;
  error?: unknown;
  tags?: ObservabilityTags;
  context?: ObservabilityContext;
  request?: NextRequest;
  requestContext?: Partial<RequestContext>;
  fingerprint?: string;
  alert?: boolean;
};

declare global {
  var __knowledgeObservabilityAlertDedup:
    | Map<string, number>
    | undefined;
}

function getServerObservabilityConfig() {
  const env = getServerEnv();

  return {
    serviceName: env.OBS_SERVICE_NAME,
    deployment: env.OBS_DEPLOYMENT_ENV,
    logLevel: env.OBS_LOG_LEVEL,
    alertWebhookUrl: env.OBS_ALERT_WEBHOOK_URL,
    alertWebhookToken: env.OBS_ALERT_WEBHOOK_TOKEN,
    alertMinSeverity: env.OBS_ALERT_MIN_SEVERITY,
    alertDedupWindowSeconds: env.OBS_ALERT_DEDUP_WINDOW_SECONDS,
    clientErrorSampleRate: env.OBS_CLIENT_ERROR_SAMPLE_RATE,
  };
}

function createRequestContext(
  req?: NextRequest,
  overrides?: Partial<RequestContext>
): RequestContext | undefined {
  if (!req && !overrides) {
    return undefined;
  }

  return {
    requestId:
      overrides?.requestId ??
      req?.headers.get("x-request-id") ??
      randomUUID(),
    method: overrides?.method ?? req?.method,
    url: overrides?.url ?? req?.nextUrl.toString(),
    pathname: overrides?.pathname ?? req?.nextUrl.pathname,
    host:
      overrides?.host ??
      req?.headers.get("x-forwarded-host") ??
      req?.headers.get("host") ??
      undefined,
    ip:
      overrides?.ip ??
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req?.headers.get("x-real-ip"),
    userAgent: overrides?.userAgent ?? req?.headers.get("user-agent"),
  };
}

function createLogEntry(input: ServerCaptureInput): ServerLogEntry {
  const config = getServerObservabilityConfig();

  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    service: config.serviceName,
    deployment: config.deployment,
    severity: normalizeSeverity(input.severity),
    source: input.source,
    message: input.message,
    tags: input.tags,
    context: input.context
      ? (sanitizeContext(input.context) as ObservabilityContext)
      : undefined,
    request: createRequestContext(input.request, input.requestContext),
    error: serializeError(input.error),
  };
}

function emitLog(entry: ServerLogEntry) {
  const config = getServerObservabilityConfig();

  if (!isSeverityAtLeast(entry.severity, config.logLevel)) {
    return;
  }

  const payload = JSON.stringify(entry);

  if (entry.severity === "debug") {
    console.debug(payload);
    return;
  }

  if (entry.severity === "info") {
    console.info(payload);
    return;
  }

  if (entry.severity === "warn") {
    console.warn(payload);
    return;
  }

  console.error(payload);
}

function getAlertDedupStore() {
  const store = globalThis.__knowledgeObservabilityAlertDedup ?? new Map<string, number>();

  if (!globalThis.__knowledgeObservabilityAlertDedup) {
    globalThis.__knowledgeObservabilityAlertDedup = store;
  }

  return store;
}

function createAlertFingerprint(entry: ServerLogEntry, explicit?: string) {
  if (explicit) {
    return explicit;
  }

  return createHash("sha256")
    .update(
      JSON.stringify({
        source: entry.source,
        severity: entry.severity,
        message: entry.message,
        errorName: entry.error?.name,
      })
    )
    .digest("hex");
}

async function dispatchAlert(entry: ServerLogEntry, fingerprint?: string) {
  const config = getServerObservabilityConfig();

  if (!config.alertWebhookUrl) {
    return;
  }

  if (!isSeverityAtLeast(entry.severity, config.alertMinSeverity)) {
    return;
  }

  const dedupStore = getAlertDedupStore();
  const dedupKey = createAlertFingerprint(entry, fingerprint);
  const now = Date.now();
  const dedupWindowMs = config.alertDedupWindowSeconds * 1000;
  const previous = dedupStore.get(dedupKey);

  // 相同指纹的告警在去重窗口内只发送一次，避免故障风暴期间持续刷屏。
  if (previous && now - previous < dedupWindowMs) {
    return;
  }

  dedupStore.set(dedupKey, now);

  try {
    await fetch(config.alertWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.alertWebhookToken
          ? { Authorization: `Bearer ${config.alertWebhookToken}` }
          : {}),
      },
      body: JSON.stringify({
        type: "knowledge-dapp-ui.alert",
        fingerprint: dedupKey,
        entry,
      }),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
        service: config.serviceName,
        deployment: config.deployment,
        severity: "warn",
        source: "observability.alert.dispatch",
        message: "Failed to dispatch observability alert",
        error: serializeError(error),
      })
    );
  }
}

/**
 * @notice 采集一条服务端事件并按配置输出日志与告警。
 * @param input 事件采集输入。
 * @returns 新生成的事件标识。
 */
export async function captureServerEvent(input: ServerCaptureInput) {
  const entry = createLogEntry(input);
  emitLog(entry);

  if (input.alert !== false) {
    await dispatchAlert(entry, input.fingerprint);
  }

  return entry.eventId;
}

/**
 * @notice 采集一条携带异常对象的服务端事件。
 * @param message 事件主消息。
 * @param input 除消息外的其余采集输入，必须包含异常对象。
 * @returns 新生成的事件标识。
 */
export async function captureServerException(
  message: string,
  input: Omit<ServerCaptureInput, "message"> & { error: unknown }
) {
  return captureServerEvent({
    ...input,
    message,
  });
}

/**
 * @notice 采集客户端上报的错误报告。
 * @param report 客户端错误报告。
 * @param input 附加的请求上下文信息。
 * @returns 命中采样时返回事件标识，否则返回 `null`。
 */
export async function captureClientErrorReport(
  report: ClientErrorReport,
  input?: {
    request?: NextRequest;
    requestContext?: Partial<RequestContext>;
  }
) {
  const config = getServerObservabilityConfig();

  // 客户端错误可能量级较大，这里按采样率过滤，避免日志与告警成本失控。
  if (Math.random() > config.clientErrorSampleRate) {
    return null;
  }

  return captureServerEvent({
    message: report.message,
    source: report.source,
    severity: normalizeSeverity(report.severity),
    tags: report.tags,
    request: input?.request,
    requestContext: input?.requestContext,
    context: {
      handled: report.handled ?? true,
      pathname: report.pathname,
      url: report.url,
      userAgent: report.userAgent,
      occurredAt: report.occurredAt,
      ...(report.context ?? {}),
    },
    error: report.error,
    fingerprint: report.fingerprint,
  });
}
