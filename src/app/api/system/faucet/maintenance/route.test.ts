import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNextRequest } from "@/test/api-route";
import { runFaucetMaintenance } from "@/lib/faucet/utils";

vi.mock("@/lib/faucet/utils", () => ({
  runFaucetMaintenance: vi.fn(),
}));

vi.mock("@/lib/observability/server", () => ({
  captureServerException: vi.fn().mockResolvedValue("event-1"),
}));

const originalSystemToken = process.env.SYSTEM_API_TOKEN;
const originalRebalanceToken = process.env.REBALANCE_API_TOKEN;

describe("POST /api/system/faucet/maintenance", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    process.env.SYSTEM_API_TOKEN = "system-secret";
    process.env.REBALANCE_API_TOKEN = "rebalance-secret";
    vi.mocked(runFaucetMaintenance).mockResolvedValue({
      status: "ok",
      relayer: {
        address: "0x1234567890abcdef1234567890abcdef12345678",
        balance: "100000000000000000",
        alertMinBalance: "50000000000000000",
      },
      topUp: {
        attempted: false,
      },
      faucetVault: {
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        balance: "100000000000000000000",
        claimAmount: "2000000000000000000",
        availableBudget: "100000000000000000000",
        paused: false,
        alertMinBalance: "10000000000000000000",
      },
      issues: [],
    });
  });

  afterEach(() => {
    if (originalSystemToken === undefined) {
      delete process.env.SYSTEM_API_TOKEN;
    } else {
      process.env.SYSTEM_API_TOKEN = originalSystemToken;
    }

    if (originalRebalanceToken === undefined) {
      delete process.env.REBALANCE_API_TOKEN;
    } else {
      process.env.REBALANCE_API_TOKEN = originalRebalanceToken;
    }
  });

  it("returns 503 when no system token is configured", async () => {
    delete process.env.SYSTEM_API_TOKEN;
    delete process.env.REBALANCE_API_TOKEN;

    const { POST } = await import("@/app/api/system/faucet/maintenance/route");
    const response = await POST(
      createNextRequest("http://localhost/api/system/faucet/maintenance", {
        method: "POST",
      })
    );

    expect(response.status).toBe(503);
  });

  it("rejects requests without a bearer token", async () => {
    const { POST } = await import("@/app/api/system/faucet/maintenance/route");
    const response = await POST(
      createNextRequest("http://localhost/api/system/faucet/maintenance", {
        method: "POST",
      })
    );

    expect(response.status).toBe(401);
  });

  it("runs maintenance with a valid token", async () => {
    const { POST } = await import("@/app/api/system/faucet/maintenance/route");
    const response = await POST(
      createNextRequest("http://localhost/api/system/faucet/maintenance", {
        method: "POST",
        headers: {
          authorization: "Bearer system-secret",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(runFaucetMaintenance).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      report: {
        status: "ok",
      },
    });
  });

  it("accepts the rebalance token as a fallback when SYSTEM_API_TOKEN is absent", async () => {
    delete process.env.SYSTEM_API_TOKEN;

    const { POST } = await import("@/app/api/system/faucet/maintenance/route");
    const response = await POST(
      createNextRequest("http://localhost/api/system/faucet/maintenance", {
        method: "POST",
        headers: {
          authorization: "Bearer rebalance-secret",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(runFaucetMaintenance).toHaveBeenCalledTimes(1);
  });
});
