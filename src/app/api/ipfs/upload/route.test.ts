import { beforeEach, describe, expect, it, vi } from "vitest";

import { createNextRequest } from "@/test/api-route";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { clearUploadSessionCookie, readUploadSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { validateUploadFileServer } from "@/lib/upload-policy";

vi.mock("@/lib/api-rate-limit", () => ({
  enforceApiRateLimits: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  clearUploadSessionCookie: vi.fn(),
  readUploadSession: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: vi.fn(),
}));

vi.mock("@/lib/upload-policy", () => ({
  validateUploadFileServer: vi.fn(),
}));

vi.mock("@/lib/observability/server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue("event-1"),
  captureServerException: vi.fn().mockResolvedValue("event-1"),
}));

const address = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;

describe("POST /api/ipfs/upload", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(enforceApiRateLimits).mockResolvedValue({ ok: true });
    vi.mocked(getServerEnv).mockReturnValue({
      NODE_ENV: "test",
      NEXT_PUBLIC_BESU_RPC_URL: "http://127.0.0.1:8545",
      NEXT_PUBLIC_BESU_CHAIN_ID: 20260,
      NEXT_PUBLIC_BLOCKSCOUT_URL: "http://127.0.0.1:8182",
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "",
      NEXT_PUBLIC_IPFS_GATEWAY_URL: "http://127.0.0.1:8080/ipfs",
      UPLOAD_PROVIDER: "local",
      IPFS_API_URL: "http://127.0.0.1:5001",
      IPFS_GATEWAY_URL: "http://127.0.0.1:8080/ipfs",
      UPLOAD_AUTH_SECRET: "secret",
      UPLOAD_AUTH_NONCE_TTL_SECONDS: 300,
      UPLOAD_AUTH_SESSION_TTL_SECONDS: 7200,
      UPLOAD_MAX_FILE_SIZE_BYTES: 1024,
      REDIS_URL: undefined,
      API_RATE_LIMIT_WINDOW_SECONDS: 60,
      API_RATE_LIMIT_MAX: 120,
      OBS_SERVICE_NAME: "knowledge-dapp-ui",
      OBS_DEPLOYMENT_ENV: "test",
      OBS_LOG_LEVEL: "info",
      OBS_ALERT_WEBHOOK_URL: "https://alerts.example.com/webhook",
      OBS_ALERT_WEBHOOK_TOKEN: undefined,
      OBS_ALERT_MIN_SEVERITY: "error",
      OBS_ALERT_DEDUP_WINDOW_SECONDS: 300,
      OBS_CLIENT_ERROR_SAMPLE_RATE: 1,
      FAUCET_AUTH_SIGNER_PRIVATE_KEY: undefined,
      FAUCET_RELAYER_PRIVATE_KEY: undefined,
      FAUCET_TOP_UP_FUNDER_PRIVATE_KEY: undefined,
      SYSTEM_API_TOKEN: undefined,
      REBALANCE_API_TOKEN: undefined,
      ADMIN_ADDRESSES: [],
      BESU_PERMISSIONING_RPC_URL: undefined,
      BESU_VALIDATOR_RPC_URLS: [],
      BESU_ADMIN_AUTH_TOKEN: undefined,
      FAUCET_AMOUNT: "2",
      FAUCET_MIN_BALANCE: "1",
      FAUCET_RELAYER_ALERT_MIN_BALANCE: "0.05",
      FAUCET_RELAYER_TOP_UP_AMOUNT: "0.2",
      FAUCET_VAULT_ALERT_MIN_BALANCE: undefined,
      FAUCET_COOLDOWN_HOURS: 24,
      FAUCET_LOCK_TTL_SECONDS: 60,
      FAUCET_NONCE_TTL_SECONDS: 300,
      FAUCET_NONCE_RATE_LIMIT_WINDOW_SECONDS: 60,
      FAUCET_NONCE_RATE_LIMIT_MAX: 5,
      FAUCET_CLAIM_RATE_LIMIT_WINDOW_SECONDS: 3600,
      FAUCET_CLAIM_RATE_LIMIT_MAX: 10,
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns the rate-limit response when blocked", async () => {
    vi.mocked(enforceApiRateLimits).mockResolvedValue({
      ok: false,
      status: 429,
      error: "limited",
      retryAfterSeconds: 60,
    });

    const { POST } = await import("@/app/api/ipfs/upload/route");
    const response = await POST(
      createNextRequest("http://localhost/api/ipfs/upload", { method: "POST" })
    );

    expect(response.status).toBe(429);
  });

  it("rejects unauthenticated uploads and clears the cookie", async () => {
    vi.mocked(readUploadSession).mockResolvedValue(null);

    const { POST } = await import("@/app/api/ipfs/upload/route");
    const response = await POST(
      createNextRequest("http://localhost/api/ipfs/upload", { method: "POST" })
    );

    expect(response.status).toBe(401);
    expect(clearUploadSessionCookie).toHaveBeenCalledWith(response);
  });

  it("returns upload validation failures", async () => {
    const formData = new FormData();
    formData.append("file", new File(["hello"], "hello.txt", { type: "text/plain" }));
    vi.mocked(readUploadSession).mockResolvedValue({
      id: "session-1",
      sub: address,
      chainId: 20260,
      version: 1,
      createdAt: 1,
      expiresAt: 2,
      lastUsedAt: 1,
    });
    vi.mocked(validateUploadFileServer).mockResolvedValue({
      ok: false,
      error: "invalid file",
      status: 400,
    });

    const { POST } = await import("@/app/api/ipfs/upload/route");
    const response = await POST(
      createNextRequest("http://localhost/api/ipfs/upload", {
        method: "POST",
        body: formData,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid file" });
  });

  it("uploads to Kubo and returns the resolved CID", async () => {
    const formData = new FormData();
    formData.append("file", new File(["hello"], "hello.txt", { type: "text/plain" }));
    vi.mocked(readUploadSession).mockResolvedValue({
      id: "session-1",
      sub: address,
      chainId: 20260,
      version: 7,
      createdAt: 1,
      expiresAt: 2,
      lastUsedAt: 1,
    });
    vi.mocked(validateUploadFileServer).mockResolvedValue({ ok: true });
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ Hash: "bafy-test-cid" }), { status: 200 })
    );

    const { POST } = await import("@/app/api/ipfs/upload/route");
    const response = await POST(
      createNextRequest("http://localhost/api/ipfs/upload", {
        method: "POST",
        body: formData,
      })
    );

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:5001/api/v0/add?pin=true",
      expect.objectContaining({ method: "POST" })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      provider: "local",
      cid: "bafy-test-cid",
      uploadedBy: address,
      sessionVersion: 7,
      url: "http://127.0.0.1:8080/ipfs/bafy-test-cid",
    });
  });
});
