import { beforeEach, describe, expect, it, vi } from "vitest";

import { createNextRequest } from "@/test/api-route";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import {
  clearUploadSessionCookie,
  readUploadSession,
  revokeUploadSessionFromRequest,
} from "@/lib/auth/session";

vi.mock("@/lib/api-rate-limit", () => ({
  enforceApiRateLimits: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  clearUploadSessionCookie: vi.fn(),
  readUploadSession: vi.fn(),
  revokeUploadSessionFromRequest: vi.fn(),
}));

const address = "0x1234567890abcdef1234567890abcdef12345678";

describe("/api/auth/session", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(enforceApiRateLimits).mockResolvedValue({ ok: true });
  });

  it("returns the rate-limit response for GET", async () => {
    vi.mocked(enforceApiRateLimits).mockResolvedValue({
      ok: false,
      status: 429,
      error: "limited",
      retryAfterSeconds: 60,
    });

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(
      createNextRequest("http://localhost/api/auth/session")
    );

    expect(response.status).toBe(429);
  });

  it("clears the session cookie when no session exists", async () => {
    vi.mocked(readUploadSession).mockResolvedValue(null);

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(
      createNextRequest("http://localhost/api/auth/session")
    );

    expect(response.status).toBe(200);
    expect(clearUploadSessionCookie).toHaveBeenCalledWith(response);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
  });

  it("returns the active session details", async () => {
    vi.mocked(readUploadSession).mockResolvedValue({
      id: "session-1",
      sub: address,
      chainId: 20260,
      version: 3,
      createdAt: 1,
      expiresAt: 2,
      lastUsedAt: 3,
    });

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(
      createNextRequest("http://localhost/api/auth/session")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authenticated: true,
      address,
      sessionVersion: 3,
    });
  });

  it("revokes the session on DELETE and clears the cookie", async () => {
    const request = createNextRequest("http://localhost/api/auth/session", {
      method: "DELETE",
    });

    const { DELETE } = await import("@/app/api/auth/session/route");
    const response = await DELETE(request);

    expect(response.status).toBe(200);
    expect(revokeUploadSessionFromRequest).toHaveBeenCalledWith(request);
    expect(clearUploadSessionCookie).toHaveBeenCalledWith(response);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
  });
});
