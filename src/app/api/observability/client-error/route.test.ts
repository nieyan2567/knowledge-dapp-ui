/**
 * 模块说明：覆盖前端错误上报接口的参数校验与接收行为。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJsonRequest } from "@/test/api-route";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { captureClientErrorReport } from "@/lib/observability/server";

vi.mock("@/lib/api-rate-limit", () => ({
  enforceApiRateLimits: vi.fn(),
}));

vi.mock("@/lib/observability/server", () => ({
  captureClientErrorReport: vi.fn(),
}));

describe("POST /api/observability/client-error", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(enforceApiRateLimits).mockResolvedValue({ ok: true });
    vi.mocked(captureClientErrorReport).mockResolvedValue("event-1");
  });

  it("returns the rate-limit response when blocked", async () => {
    vi.mocked(enforceApiRateLimits).mockResolvedValue({
      ok: false,
      status: 429,
      error: "limited",
      retryAfterSeconds: 60,
    });

    const { POST } = await import("@/app/api/observability/client-error/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/observability/client-error", "POST", {})
    );

    expect(response.status).toBe(429);
  });

  it("rejects invalid payloads", async () => {
    const { POST } = await import("@/app/api/observability/client-error/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/observability/client-error", "POST", {})
    );

    expect(response.status).toBe(400);
  });

  it("captures valid client error reports", async () => {
    const { POST } = await import("@/app/api/observability/client-error/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/observability/client-error", "POST", {
        message: "Unhandled promise rejection",
        source: "window.unhandledrejection",
        severity: "error",
        pathname: "/content",
      })
    );

    expect(response.status).toBe(202);
    expect(captureClientErrorReport).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      eventId: "event-1",
    });
  });
});
