/**
 * 模块说明：覆盖上传鉴权签名校验与会话创建行为。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJsonRequest } from "@/test/api-route";
import { getKnowledgeChain } from "@/lib/chains";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { takeUploadAuthChallenge } from "@/lib/auth/nonce-store";
import { createUploadSession, setUploadSessionCookie } from "@/lib/auth/session";
import { verifyMessage } from "viem";

vi.mock("@/lib/api-rate-limit", () => ({
  enforceApiRateLimits: vi.fn(),
}));

vi.mock("@/lib/auth/nonce-store", () => ({
  takeUploadAuthChallenge: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  createUploadSession: vi.fn(),
  setUploadSessionCookie: vi.fn(),
}));

vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    verifyMessage: vi.fn(),
  };
});

const address = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;

describe("POST /api/auth/verify", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(enforceApiRateLimits).mockResolvedValue({ ok: true });
  });

  it("returns the rate-limit response when blocked", async () => {
    vi.mocked(enforceApiRateLimits).mockResolvedValue({
      ok: false,
      status: 429,
      error: "limited",
      retryAfterSeconds: 60,
    });

    const { POST } = await import("@/app/api/auth/verify/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/auth/verify", "POST", {})
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "limited" });
  });

  it("rejects requests with an expired challenge", async () => {
    vi.mocked(takeUploadAuthChallenge).mockResolvedValue(null);

    const { POST } = await import("@/app/api/auth/verify/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/auth/verify", "POST", {
        address,
        nonce: "nonce-1",
        signature: "0x1234",
      })
    );

    expect(response.status).toBe(401);
  });

  it("rejects requests when the challenge does not match the site", async () => {
    vi.mocked(takeUploadAuthChallenge).mockResolvedValue({
      nonce: "nonce-1",
      issuedAt: "2026-03-24T00:00:00.000Z",
      domain: "example.com",
      origin: "https://example.com",
      chainId: getKnowledgeChain().id,
    });

    const { POST } = await import("@/app/api/auth/verify/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/auth/verify", "POST", {
        address,
        nonce: "nonce-1",
        signature: "0x1234",
      })
    );

    expect(response.status).toBe(401);
  });

  it("rejects invalid wallet signatures", async () => {
    vi.mocked(takeUploadAuthChallenge).mockResolvedValue({
      nonce: "nonce-1",
      issuedAt: "2026-03-24T00:00:00.000Z",
      domain: "localhost",
      origin: "http://localhost",
      chainId: getKnowledgeChain().id,
    });
    vi.mocked(verifyMessage).mockResolvedValue(false);

    const { POST } = await import("@/app/api/auth/verify/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/auth/verify", "POST", {
        address,
        nonce: "nonce-1",
        signature: "0x1234",
      })
    );

    expect(response.status).toBe(401);
  });

  it("creates a session and sets the session cookie on success", async () => {
    vi.mocked(takeUploadAuthChallenge).mockResolvedValue({
      nonce: "nonce-1",
      issuedAt: "2026-03-24T00:00:00.000Z",
      domain: "localhost",
      origin: "http://localhost",
      chainId: getKnowledgeChain().id,
    });
    vi.mocked(verifyMessage).mockResolvedValue(true);
    vi.mocked(createUploadSession).mockResolvedValue({
      session: {
        id: "session-1",
        sub: address,
        chainId: getKnowledgeChain().id,
        version: 2,
        createdAt: 1,
        expiresAt: 2,
        lastUsedAt: 1,
      },
      token: "signed-token",
    });

    const { POST } = await import("@/app/api/auth/verify/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/auth/verify", "POST", {
        address,
        nonce: "nonce-1",
        signature: "0x1234",
      })
    );

    expect(response.status).toBe(200);
    expect(setUploadSessionCookie).toHaveBeenCalledTimes(1);
    const body = await response.json();
    expect(body).toMatchObject({
      authenticated: true,
      chainId: getKnowledgeChain().id,
      sessionVersion: 2,
    });
    expect(String(body.address).toLowerCase()).toBe(address.toLowerCase());
  });
});
