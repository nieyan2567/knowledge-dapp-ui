import { beforeEach, describe, expect, it, vi } from "vitest";

import { createNextRequest } from "@/test/api-route";
import { knowledgeChain } from "@/lib/chains";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { createFaucetAuthChallenge } from "@/lib/faucet/nonce-store";
import {
  checkFaucetClaimEligibility,
  createRequestContextHashes,
  enforceFaucetRateLimit,
  getRequestIp,
  getRequestUserAgent,
} from "@/lib/faucet/utils";

vi.mock("@/lib/api-rate-limit", () => ({
  enforceApiRateLimits: vi.fn(),
}));

vi.mock("@/lib/faucet/nonce-store", () => ({
  createFaucetAuthChallenge: vi.fn(),
}));

vi.mock("@/lib/faucet/utils", () => ({
  checkFaucetClaimEligibility: vi.fn(),
  createRequestContextHashes: vi.fn(),
  enforceFaucetRateLimit: vi.fn(),
  getRequestIp: vi.fn(),
  getRequestUserAgent: vi.fn(),
  isFaucetError: vi.fn(() => false),
}));

const address = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;

describe("GET /api/faucet/nonce", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(enforceApiRateLimits).mockResolvedValue({ ok: true });
    vi.mocked(getRequestIp).mockReturnValue("127.0.0.1");
    vi.mocked(getRequestUserAgent).mockReturnValue("vitest-agent");
    vi.mocked(createRequestContextHashes).mockReturnValue({
      address,
      ipHash: "ip-hash",
      userAgentHash: "ua-hash",
    });
    vi.mocked(enforceFaucetRateLimit).mockResolvedValue(undefined);
    vi.mocked(checkFaucetClaimEligibility).mockResolvedValue({ ok: true });
  });

  it("returns the rate-limit response when blocked", async () => {
    vi.mocked(enforceApiRateLimits).mockResolvedValue({
      ok: false,
      status: 429,
      error: "limited",
      retryAfterSeconds: 60,
    });

    const { GET } = await import("@/app/api/faucet/nonce/route");
    const response = await GET(
      createNextRequest(`http://localhost/api/faucet/nonce?address=${address}`)
    );

    expect(response.status).toBe(429);
  });

  it("rejects invalid query parameters", async () => {
    const { GET } = await import("@/app/api/faucet/nonce/route");
    const response = await GET(
      createNextRequest("http://localhost/api/faucet/nonce")
    );

    expect(response.status).toBe(400);
  });

  it("returns faucet eligibility failures", async () => {
    vi.mocked(checkFaucetClaimEligibility).mockResolvedValue({
      ok: false,
      status: 429,
      error: "cooldown",
    });

    const { GET } = await import("@/app/api/faucet/nonce/route");
    const response = await GET(
      createNextRequest(`http://localhost/api/faucet/nonce?address=${address}`)
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "cooldown" });
  });

  it("creates a faucet auth challenge for an eligible address", async () => {
    vi.mocked(createFaucetAuthChallenge).mockResolvedValue({
      nonce: "nonce-1",
      issuedAt: "2026-03-24T00:00:00.000Z",
      domain: "localhost",
      origin: "http://localhost",
      chainId: knowledgeChain.id,
      address,
      ipHash: "ip-hash",
      userAgentHash: "ua-hash",
    });

    const { GET } = await import("@/app/api/faucet/nonce/route");
    const response = await GET(
      createNextRequest(`http://localhost/api/faucet/nonce?address=${address}`)
    );

    expect(createFaucetAuthChallenge).toHaveBeenCalledWith({
      domain: "localhost",
      origin: "http://localhost",
      chainId: knowledgeChain.id,
      address,
      ipHash: "ip-hash",
      userAgentHash: "ua-hash",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
