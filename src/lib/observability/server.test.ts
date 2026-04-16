/**
 * @notice `observability/server` 模块测试。
 * @dev 覆盖结构化日志、告警去重和客户端错误上报接入。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureClientErrorReport,
  captureServerException,
  captureServerEvent,
} from "@/lib/observability/server";

const originalEnv = {
  OBS_SERVICE_NAME: process.env.OBS_SERVICE_NAME,
  OBS_DEPLOYMENT_ENV: process.env.OBS_DEPLOYMENT_ENV,
  OBS_LOG_LEVEL: process.env.OBS_LOG_LEVEL,
  OBS_ALERT_WEBHOOK_URL: process.env.OBS_ALERT_WEBHOOK_URL,
  OBS_ALERT_WEBHOOK_TOKEN: process.env.OBS_ALERT_WEBHOOK_TOKEN,
  OBS_ALERT_MIN_SEVERITY: process.env.OBS_ALERT_MIN_SEVERITY,
  OBS_ALERT_DEDUP_WINDOW_SECONDS: process.env.OBS_ALERT_DEDUP_WINDOW_SECONDS,
  OBS_CLIENT_ERROR_SAMPLE_RATE: process.env.OBS_CLIENT_ERROR_SAMPLE_RATE,
};

const mutableEnv = process.env as Record<string, string | undefined>;

describe("observability/server", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    globalThis.__knowledgeObservabilityAlertDedup = undefined;
    mutableEnv.OBS_SERVICE_NAME = "knowledge-dapp-ui";
    mutableEnv.OBS_DEPLOYMENT_ENV = "test";
    mutableEnv.OBS_LOG_LEVEL = "info";
    delete mutableEnv.OBS_ALERT_WEBHOOK_URL;
    delete mutableEnv.OBS_ALERT_WEBHOOK_TOKEN;
    mutableEnv.OBS_ALERT_MIN_SEVERITY = "error";
    mutableEnv.OBS_ALERT_DEDUP_WINDOW_SECONDS = "60";
    mutableEnv.OBS_CLIENT_ERROR_SAMPLE_RATE = "1";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 202 })));
  });

  afterEach(() => {
    mutableEnv.OBS_SERVICE_NAME = originalEnv.OBS_SERVICE_NAME;
    mutableEnv.OBS_DEPLOYMENT_ENV = originalEnv.OBS_DEPLOYMENT_ENV;
    mutableEnv.OBS_LOG_LEVEL = originalEnv.OBS_LOG_LEVEL;
    mutableEnv.OBS_ALERT_WEBHOOK_URL = originalEnv.OBS_ALERT_WEBHOOK_URL;
    mutableEnv.OBS_ALERT_WEBHOOK_TOKEN = originalEnv.OBS_ALERT_WEBHOOK_TOKEN;
    mutableEnv.OBS_ALERT_MIN_SEVERITY = originalEnv.OBS_ALERT_MIN_SEVERITY;
    mutableEnv.OBS_ALERT_DEDUP_WINDOW_SECONDS = originalEnv.OBS_ALERT_DEDUP_WINDOW_SECONDS;
    mutableEnv.OBS_CLIENT_ERROR_SAMPLE_RATE = originalEnv.OBS_CLIENT_ERROR_SAMPLE_RATE;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("writes structured logs for server events", async () => {
    await captureServerEvent({
      message: "Upload succeeded",
      source: "ipfs.upload",
      severity: "info",
      context: { cid: "bafy" },
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      service: "knowledge-dapp-ui",
      deployment: "test",
      severity: "info",
      source: "ipfs.upload",
      message: "Upload succeeded",
      context: {
        cid: "bafy",
      },
    });
  });

  it("writes warning events to console.warn", async () => {
    await captureServerEvent({
      message: "Rate limit threshold reached",
      source: "api.rate-limit",
      severity: "warn",
      context: { route: "/api/auth/nonce" },
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    const payload = JSON.parse(String(warnSpy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      service: "knowledge-dapp-ui",
      deployment: "test",
      severity: "warn",
      source: "api.rate-limit",
      message: "Rate limit threshold reached",
      context: {
        route: "/api/auth/nonce",
      },
    });
  });

  it("dispatches deduplicated alerts for server exceptions", async () => {
    mutableEnv.OBS_ALERT_WEBHOOK_URL = "https://example.com/alert";

    await captureServerException("Upload failed", {
      source: "ipfs.upload",
      error: new Error("boom"),
      severity: "error",
    });

    await captureServerException("Upload failed", {
      source: "ipfs.upload",
      error: new Error("boom"),
      severity: "error",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("captures client error reports on the server", async () => {
    await captureClientErrorReport({
      message: "Unhandled render error",
      source: "window.error",
      severity: "error",
      pathname: "/content",
      handled: false,
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      source: "window.error",
      message: "Unhandled render error",
      context: {
        pathname: "/content",
        handled: false,
      },
    });
  });
});
