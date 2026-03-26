import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNextRequest } from "@/test/api-route";
import { rebalanceRevenueVault } from "@/lib/faucet/utils";

vi.mock("@/lib/faucet/utils", () => ({
  rebalanceRevenueVault: vi.fn(),
}));

vi.mock("@/lib/observability/server", () => ({
  captureServerException: vi.fn().mockResolvedValue("event-1"),
}));

const originalToken = process.env.REBALANCE_API_TOKEN;

describe("POST /api/system/rebalance", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    process.env.REBALANCE_API_TOKEN = "rebalance-secret";
    vi.mocked(rebalanceRevenueVault).mockResolvedValue("0xrebalance");
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.REBALANCE_API_TOKEN;
    } else {
      process.env.REBALANCE_API_TOKEN = originalToken;
    }
  });

  it("returns 503 when the token is not configured", async () => {
    delete process.env.REBALANCE_API_TOKEN;

    const { POST } = await import("@/app/api/system/rebalance/route");
    const response = await POST(
      createNextRequest("http://localhost/api/system/rebalance", {
        method: "POST",
      })
    );

    expect(response.status).toBe(503);
  });

  it("rejects requests without a bearer token", async () => {
    const { POST } = await import("@/app/api/system/rebalance/route");
    const response = await POST(
      createNextRequest("http://localhost/api/system/rebalance", {
        method: "POST",
      })
    );

    expect(response.status).toBe(401);
  });

  it("rejects requests with an invalid bearer token", async () => {
    const { POST } = await import("@/app/api/system/rebalance/route");
    const response = await POST(
      createNextRequest("http://localhost/api/system/rebalance", {
        method: "POST",
        headers: {
          authorization: "Bearer wrong-token",
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns 503 when RevenueVault is unavailable", async () => {
    vi.mocked(rebalanceRevenueVault).mockResolvedValue(null);

    const { POST } = await import("@/app/api/system/rebalance/route");
    const response = await POST(
      createNextRequest("http://localhost/api/system/rebalance", {
        method: "POST",
        headers: {
          authorization: "Bearer rebalance-secret",
        },
      })
    );

    expect(response.status).toBe(503);
  });

  it("triggers a rebalance with a valid token", async () => {
    const { POST } = await import("@/app/api/system/rebalance/route");
    const response = await POST(
      createNextRequest("http://localhost/api/system/rebalance", {
        method: "POST",
        headers: {
          authorization: "Bearer rebalance-secret",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(rebalanceRevenueVault).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      txHash: "0xrebalance",
    });
  });
});
