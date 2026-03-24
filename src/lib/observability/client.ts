"use client";

import {
  sanitizeContext,
  serializeError,
  type ClientErrorReport,
  type ObservabilityContext,
  type ObservabilitySeverity,
  type ObservabilityTags,
} from "@/lib/observability/shared";

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

export async function reportClientError(input: ClientCaptureInput) {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return;
  }

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
    // Swallow client-side telemetry transport failures.
  }
}
