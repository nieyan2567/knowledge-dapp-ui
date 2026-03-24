import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJsonRequest } from "@/test/api-route";
import { knowledgeChain } from "@/lib/chains";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { takeFaucetAuthChallenge } from "@/lib/faucet/nonce-store";
import {
  acquireFaucetClaimLock,
  checkFaucetClaimEligibility,
  createRequestContextHashes,
  enforceFaucetRateLimit,
  formatFaucetAmount,
  getCooldownRemainingSeconds,
  getFaucetAmount,
  getFaucetClients,
  getFaucetMinBalance,
  getRequestIp,
  getRequestUserAgent,
  markFaucetClaimed,
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
  createRequestContextHashes: vi.fn(),
  enforceFaucetRateLimit: vi.fn(),
  formatFaucetAmount: vi.fn(),
  getCooldownRemainingSeconds: vi.fn(),
  getFaucetAmount: vi.fn(),
  getFaucetClients: vi.fn(),
  getFaucetMinBalance: vi.fn(),
  getRequestIp: vi.fn(),
  getRequestUserAgent: vi.fn(),
  isFaucetError: vi.fn(() => false),
  markFaucetClaimed: vi.fn(),
  releaseFaucetClaimLock: vi.fn(),
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
  chainId: knowledgeChain.id,
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
    vi.mocked(checkFaucetClaimEligibility).mockResolvedValue({ ok: true });
    vi.mocked(acquireFaucetClaimLock).mockResolvedValue({
      entries: [{ key: "lock", token: "token" }],
    });
    vi.mocked(getFaucetAmount).mockReturnValue(2n);
    vi.mocked(getFaucetMinBalance).mockReturnValue(1n);
    vi.mocked(formatFaucetAmount).mockReturnValue("2 KC");
    vi.mocked(getFaucetClients).mockResolvedValue(
      {
        account: { address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        publicClient: {
          getBalance: vi
            .fn()
            .mockResolvedValueOnce(0n)
            .mockResolvedValueOnce(10n),
        },
        walletClient: {
          sendTransaction: vi.fn().mockResolvedValue("0xtxhash"),
        },
      } as unknown as Awaited<ReturnType<typeof getFaucetClients>>
    );
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
});
