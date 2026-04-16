/**
 * 模块说明：覆盖 Faucet 领取签名校验、加锁和代领提交流程。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJsonRequest } from "@/test/api-route";
import { getKnowledgeChain } from "@/lib/chains";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { takeFaucetAuthChallenge } from "@/lib/faucet/nonce-store";
import {
  acquireFaucetClaimLock,
  checkFaucetClaimEligibility,
  createFaucetClaimAuthorization,
  createRequestContextHashes,
  enforceFaucetRateLimit,
  FaucetInfraError,
  formatFaucetAmount,
  getCooldownRemainingSeconds,
  getRequestIp,
  getRequestUserAgent,
  isFaucetError,
  markFaucetClaimed,
  rebalanceRevenueVault,
  runFaucetMaintenance,
  submitFaucetClaim,
} from "@/lib/faucet/utils";
import { verifyMessage } from "viem";

vi.mock("@/lib/api-rate-limit", () => ({
  enforceApiRateLimits: vi.fn(),
}));

vi.mock("@/lib/faucet/nonce-store", () => ({
  takeFaucetAuthChallenge: vi.fn(),
}));

vi.mock("@/lib/faucet/utils", () => ({
  acquireFaucetClaimLock: vi.fn(),
  checkFaucetClaimEligibility: vi.fn(),
  createFaucetClaimAuthorization: vi.fn(),
  createRequestContextHashes: vi.fn(),
  enforceFaucetRateLimit: vi.fn(),
  FaucetInfraError: class FaucetInfraError extends Error {
    status = 503;
  },
  formatFaucetAmount: vi.fn(),
  getCooldownRemainingSeconds: vi.fn(),
  getRequestIp: vi.fn(),
  getRequestUserAgent: vi.fn(),
  isFaucetError: vi.fn(() => false),
  markFaucetClaimed: vi.fn(),
  rebalanceRevenueVault: vi.fn(),
  releaseFaucetClaimLock: vi.fn(),
  runFaucetMaintenance: vi.fn(),
  submitFaucetClaim: vi.fn(),
}));

vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    verifyMessage: vi.fn(),
  };
});

vi.mock("@/lib/observability/server", () => ({
  captureServerException: vi.fn().mockResolvedValue("event-1"),
}));

const address = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;
const challenge = {
  nonce: "nonce-1",
  issuedAt: "2026-03-24T00:00:00.000Z",
  domain: "localhost",
  origin: "http://localhost",
  chainId: getKnowledgeChain().id,
  address,
  ipHash: "ip-hash",
  userAgentHash: "ua-hash",
};

describe("POST /api/faucet/claim", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(enforceApiRateLimits).mockResolvedValue({ ok: true });
    vi.mocked(takeFaucetAuthChallenge).mockResolvedValue(challenge);
    vi.mocked(getRequestIp).mockReturnValue("127.0.0.1");
    vi.mocked(getRequestUserAgent).mockReturnValue("vitest-agent");
    vi.mocked(createRequestContextHashes).mockReturnValue({
      address,
      ipHash: "ip-hash",
      userAgentHash: "ua-hash",
    });
    vi.mocked(verifyMessage).mockResolvedValue(true);
    vi.mocked(enforceFaucetRateLimit).mockResolvedValue(undefined);
    vi.mocked(runFaucetMaintenance).mockResolvedValue({
      status: "ok",
      relayer: {
        address: "0x6c7a4f6C81B0d9dc937fC04e5090b168F050dbCF",
        balance: "100000000000000000",
        alertMinBalance: "50000000000000000",
      },
      topUp: { attempted: false },
      faucetVault: {
        address: "0xd0de0912991896691E3671157A2adada5B102aFB",
        balance: "100000000000000000000",
        claimAmount: "2000000000000000000",
        availableBudget: "20000000000000000000",
        paused: false,
      },
      issues: [],
    });
    vi.mocked(checkFaucetClaimEligibility).mockResolvedValue({
      ok: true,
      amount: 2n,
      minAllowedBalance: 1n,
    });
    vi.mocked(acquireFaucetClaimLock).mockResolvedValue({
      entries: [{ key: "lock", token: "token" }],
    });
    vi.mocked(createFaucetClaimAuthorization).mockResolvedValue({
      amount: 2n,
      deadline: 12345n,
      nonce: "0xnonce",
      signature: "0xsigned",
    });
    vi.mocked(formatFaucetAmount).mockReturnValue("2 KC");
    vi.mocked(rebalanceRevenueVault).mockResolvedValue("0xrebalance");
    vi.mocked(submitFaucetClaim).mockResolvedValue("0xtxhash");
    vi.mocked(markFaucetClaimed).mockResolvedValue(undefined);
  });

  it("returns the rate-limit response when blocked", async () => {
    vi.mocked(enforceApiRateLimits).mockResolvedValue({
      ok: false,
      status: 429,
      error: "limited",
      retryAfterSeconds: 60,
    });

    const { POST } = await import("@/app/api/faucet/claim/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/faucet/claim", "POST", {})
    );

    expect(response.status).toBe(429);
  });

  it("rejects missing or expired challenges", async () => {
    vi.mocked(takeFaucetAuthChallenge).mockResolvedValue(null);

    const { POST } = await import("@/app/api/faucet/claim/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/faucet/claim", "POST", {
        address,
        nonce: "nonce-1",
        signature: "0x1234",
      })
    );

    expect(response.status).toBe(401);
  });

  it("rejects invalid wallet signatures", async () => {
    vi.mocked(verifyMessage).mockResolvedValue(false);

    const { POST } = await import("@/app/api/faucet/claim/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/faucet/claim", "POST", {
        address,
        nonce: "nonce-1",
        signature: "0x1234",
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns a cooldown response when the claim lock cannot be acquired", async () => {
    vi.mocked(acquireFaucetClaimLock).mockResolvedValue(null);
    vi.mocked(getCooldownRemainingSeconds).mockResolvedValue(30);

    const { POST } = await import("@/app/api/faucet/claim/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/faucet/claim", "POST", {
        address,
        nonce: "nonce-1",
        signature: "0x1234",
      })
    );

    expect(response.status).toBe(429);
  });

  it("transfers funds and records a successful claim", async () => {
    const { POST } = await import("@/app/api/faucet/claim/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/faucet/claim", "POST", {
        address,
        nonce: "nonce-1",
        signature: "0x1234",
      })
    );

    expect(response.status).toBe(200);
    expect(runFaucetMaintenance).toHaveBeenCalledTimes(1);
    expect(rebalanceRevenueVault).toHaveBeenCalledTimes(1);
    expect(createFaucetClaimAuthorization).toHaveBeenCalledTimes(1);
    expect(
      String(vi.mocked(createFaucetClaimAuthorization).mock.calls[0]?.[0]).toLowerCase()
    ).toBe(address.toLowerCase());
    expect(submitFaucetClaim).toHaveBeenCalledTimes(1);
    expect(vi.mocked(submitFaucetClaim).mock.calls[0]?.[0]).toMatchObject({
      amount: 2n,
      deadline: 12345n,
      nonce: "0xnonce",
      signature: "0xsigned",
    });
    expect(
      String(vi.mocked(submitFaucetClaim).mock.calls[0]?.[0]?.recipient).toLowerCase()
    ).toBe(address.toLowerCase());
    expect(markFaucetClaimed).toHaveBeenCalledTimes(1);
    const claimedRecord = vi.mocked(markFaucetClaimed).mock.calls[0]?.[0];
    expect(claimedRecord).toMatchObject({
      amount: "2",
      txHash: "0xtxhash",
      ip: "127.0.0.1",
    });
    expect(String(claimedRecord?.address).toLowerCase()).toBe(address.toLowerCase());
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      txHash: "0xtxhash",
      amount: "2",
      displayAmount: "2 KC",
    });
    expect(String(body.address).toLowerCase()).toBe(address.toLowerCase());
  });

  it("continues the claim flow when revenue vault rebalance fails", async () => {
    vi.mocked(rebalanceRevenueVault).mockRejectedValueOnce(new Error("rebalance failed"));

    const { POST } = await import("@/app/api/faucet/claim/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/faucet/claim", "POST", {
        address,
        nonce: "nonce-1",
        signature: "0x1234",
      })
    );

    expect(response.status).toBe(200);
    expect(runFaucetMaintenance).toHaveBeenCalledTimes(1);
    expect(rebalanceRevenueVault).toHaveBeenCalledTimes(1);
    expect(submitFaucetClaim).toHaveBeenCalledTimes(1);
    expect(markFaucetClaimed).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when relayer balance is still below threshold after maintenance", async () => {
    vi.mocked(runFaucetMaintenance).mockResolvedValueOnce({
      status: "degraded",
      relayer: {
        address: "0x6c7a4f6C81B0d9dc937fC04e5090b168F050dbCF",
        balance: "0",
        alertMinBalance: "50000000000000000",
      },
      topUp: {
        attempted: true,
        error: "Top-up failed",
      },
      faucetVault: {
        address: "0xd0de0912991896691E3671157A2adada5B102aFB",
        balance: "100000000000000000000",
        claimAmount: "2000000000000000000",
        availableBudget: "20000000000000000000",
        paused: false,
      },
      issues: ["Top-up failed"],
    });

    vi.mocked(isFaucetError).mockImplementation(
      (error) => error instanceof FaucetInfraError
    );

    const { POST } = await import("@/app/api/faucet/claim/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/faucet/claim", "POST", {
        address,
        nonce: "nonce-1",
        signature: "0x1234",
      })
    );

    expect(response.status).toBe(503);
    expect(submitFaucetClaim).not.toHaveBeenCalled();
  });
});
