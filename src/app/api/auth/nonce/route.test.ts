import { beforeEach, describe, expect, it, vi } from "vitest";

import { createNextRequest } from "@/test/api-route";
import { getKnowledgeChain } from "@/lib/chains";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { createUploadAuthChallenge } from "@/lib/auth/nonce-store";

vi.mock("@/lib/api-rate-limit", () => ({
  enforceApiRateLimits: vi.fn(),
}));

vi.mock("@/lib/auth/nonce-store", () => ({
  createUploadAuthChallenge: vi.fn(),
}));

describe("GET /api/auth/nonce", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("returns the rate-limit response when blocked", async () => {
    vi.mocked(enforceApiRateLimits).mockResolvedValue({
      ok: false,
      status: 429,
      error: "limited",
      retryAfterSeconds: 60,
    });

    const { GET } = await import("@/app/api/auth/nonce/route");
    const response = await GET(
      createNextRequest("http://localhost/api/auth/nonce")
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "limited" });
  });

  it("creates an upload challenge for the current site", async () => {
    vi.mocked(enforceApiRateLimits).mockResolvedValue({ ok: true });
    vi.mocked(createUploadAuthChallenge).mockResolvedValue({
      nonce: "nonce-1",
      issuedAt: "2026-03-24T00:00:00.000Z",
      domain: "localhost",
      origin: "http://localhost",
      chainId: getKnowledgeChain().id,
    });

    const { GET } = await import("@/app/api/auth/nonce/route");
    const response = await GET(
      createNextRequest("http://localhost/api/auth/nonce")
    );

    expect(createUploadAuthChallenge).toHaveBeenCalledWith({
      domain: "localhost",
      origin: "http://localhost",
      chainId: getKnowledgeChain().id,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      nonce: "nonce-1",
      chainId: getKnowledgeChain().id,
    });
  });
});
