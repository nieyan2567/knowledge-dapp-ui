/**
 * @file 上传鉴权会话测试模块。
 * @description 校验上传会话的签发、读取、失效、吊销和开发环境兜底行为。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import {
  createUploadSession,
  getUploadSessionTtlSeconds,
  readUploadSession,
  revokeUploadSessionFromRequest,
  setUploadSessionCookie,
} from "./session";
import { __resetUploadSessionStoreForTests } from "./session-store";

const address = "0x1234567890abcdef1234567890abcdef12345678" as const;
const mutableEnv = process.env as Record<string, string | undefined>;
const originalRedisUrl = process.env.REDIS_URL;
const originalSecret = process.env.UPLOAD_AUTH_SECRET;
const originalTtl = process.env.UPLOAD_AUTH_SESSION_TTL_SECONDS;
const originalNodeEnv = process.env.NODE_ENV;

function createRequest(path: string, init?: { cookie?: string; userAgent?: string }) {
  const headers = new Headers();

  if (init?.cookie) {
    headers.set("cookie", init.cookie);
  }

  if (init?.userAgent) {
    headers.set("user-agent", init.userAgent);
  }

  return new NextRequest(new Request(`http://localhost${path}`, { headers }));
}

async function issueSession(userAgent = "vitest-agent") {
  const authRequest = createRequest("/api/auth/verify", { userAgent });
  const { token, session } = await createUploadSession({
    address,
    chainId: 20260,
    req: authRequest,
  });
  const response = NextResponse.json({ ok: true });
  setUploadSessionCookie(response, token);
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    throw new Error("Missing set-cookie header");
  }

  return {
    session,
    cookie: setCookie.split(";")[0],
  };
}

beforeEach(() => {
  mutableEnv.NODE_ENV = "test";
  process.env.REDIS_URL = "";
  process.env.UPLOAD_AUTH_SECRET = "test-upload-secret";
  delete process.env.UPLOAD_AUTH_SESSION_TTL_SECONDS;
  globalThis.__knowledgeUploadSessionSecretWarned = undefined;
  __resetUploadSessionStoreForTests();
});

afterEach(() => {
  mutableEnv.NODE_ENV = originalNodeEnv;
  process.env.REDIS_URL = originalRedisUrl;
  process.env.UPLOAD_AUTH_SECRET = originalSecret;
  process.env.UPLOAD_AUTH_SESSION_TTL_SECONDS = originalTtl;
  globalThis.__knowledgeUploadSessionSecretWarned = undefined;
  __resetUploadSessionStoreForTests();
});

describe("auth/session", () => {
  it("uses a shorter default session ttl", () => {
    expect(getUploadSessionTtlSeconds()).toBe(7200);
  });

  it("warns once when development falls back to the default upload secret", async () => {
    mutableEnv.NODE_ENV = "development";
    process.env.UPLOAD_AUTH_SECRET = "";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await issueSession();
    await issueSession("another-agent");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("UPLOAD_AUTH_SECRET is not configured");

    warn.mockRestore();
  });

  it("reads a valid session from the signed cookie", async () => {
    const { session, cookie } = await issueSession();
    const request = createRequest("/api/auth/session", {
      cookie,
      userAgent: "vitest-agent",
    });

    const currentSession = await readUploadSession(request);

    expect(currentSession).not.toBeNull();
    expect(currentSession?.sub).toBe(address);
    expect(currentSession?.chainId).toBe(20260);
    expect(currentSession?.version).toBe(session.version);
  });

  it("invalidates the old session when the same address authenticates again", async () => {
    const first = await issueSession("agent-a");
    const second = await issueSession("agent-b");

    const firstRequest = createRequest("/api/auth/session", {
      cookie: first.cookie,
      userAgent: "agent-a",
    });
    const secondRequest = createRequest("/api/auth/session", {
      cookie: second.cookie,
      userAgent: "agent-b",
    });

    expect(await readUploadSession(firstRequest)).toBeNull();
    expect((await readUploadSession(secondRequest))?.version).toBe(2);
  });

  it("revokes a session when the request user-agent no longer matches", async () => {
    const { cookie } = await issueSession("agent-a");

    const mismatchedRequest = createRequest("/api/auth/session", {
      cookie,
      userAgent: "agent-b",
    });
    const originalRequest = createRequest("/api/auth/session", {
      cookie,
      userAgent: "agent-a",
    });

    expect(await readUploadSession(mismatchedRequest)).toBeNull();
    expect(await readUploadSession(originalRequest)).toBeNull();
  });

  it("supports explicit revoke via the session route helper", async () => {
    const { cookie } = await issueSession();
    const request = createRequest("/api/auth/session", {
      cookie,
      userAgent: "vitest-agent",
    });

    await revokeUploadSessionFromRequest(request);

    expect(await readUploadSession(request)).toBeNull();
  });
});
