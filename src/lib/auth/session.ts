/**
 * @notice 上传鉴权会话管理工具。
 * @dev 负责会话签名、Cookie 读写、来源校验以及会话续期与撤销。
 */
import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

import { getRequestSite } from "@/lib/auth/request";
import { getServerEnv } from "@/lib/env";

import {
  createUploadSessionRecord,
  getUploadSessionRecord,
  isUploadSessionVersionCurrent,
  revokeUploadSession,
  touchUploadSessionRecord,
} from "@/lib/auth/session-store";

const uploadSessionCookieName = "knowledge_upload_session";
const defaultUploadSessionTtlSeconds = 2 * 60 * 60;
const defaultUploadSessionSecret = "knowledge-dapp-dev-upload-secret";

declare global {
  var __knowledgeUploadSessionSecretWarned: boolean | undefined;
}

/**
 * @notice 暴露给业务层的上传会话结构。
 * @dev 不包含内部来源信息和 User-Agent 哈希，仅保留业务所需字段。
 */
export type UploadSession = {
  id: string;
  sub: `0x${string}`;
  chainId: number;
  version: number;
  createdAt: number;
  expiresAt: number;
  lastUsedAt: number;
};

function getUploadSessionSecret() {
  const env = getServerEnv();

  if (!env.UPLOAD_AUTH_SECRET) {
    if (
      env.NODE_ENV === "development" &&
      !globalThis.__knowledgeUploadSessionSecretWarned
    ) {
      globalThis.__knowledgeUploadSessionSecretWarned = true;
      console.warn(
        "UPLOAD_AUTH_SECRET is not configured. Falling back to the shared development upload session secret. Set a custom secret in .env.local to avoid sharing upload sessions across local environments."
      );
    }

    return defaultUploadSessionSecret;
  }

  return env.UPLOAD_AUTH_SECRET;
}

/**
 * @notice 获取上传会话 TTL。
 * @returns 规范化后的会话有效期秒数。
 */
export function getUploadSessionTtlSeconds() {
  const ttl =
    getServerEnv().UPLOAD_AUTH_SESSION_TTL_SECONDS ||
    defaultUploadSessionTtlSeconds;

  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error("UPLOAD_AUTH_SESSION_TTL_SECONDS must be a positive number");
  }

  return Math.floor(ttl);
}

function sign(value: string) {
  return createHmac("sha256", getUploadSessionSecret())
    .update(value)
    .digest("base64url");
}

function createSignedSessionToken(sessionId: string) {
  return `${sessionId}.${sign(sessionId)}`;
}

function readSignedSessionId(req: NextRequest) {
  const token = req.cookies.get(uploadSessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const [sessionId, providedSignature] = token.split(".");

  if (!sessionId || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(sessionId);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  return sessionId;
}

function hashUserAgent(value: string | null) {
  return createHash("sha256")
    .update(value?.trim() || "unknown")
    .digest("base64url");
}

/**
 * @notice 创建新的上传会话。
 * @param input 会话创建参数。
 * @param input.address 当前钱包地址。
 * @param input.chainId 当前链 ID。
 * @param input.req 当前请求对象。
 * @returns 包含业务会话对象和已签名 Cookie token 的结果。
 */
export async function createUploadSession(input: {
  address: `0x${string}`;
  chainId: number;
  req: NextRequest;
}) {
  const { domain, origin } = getRequestSite(input.req);
  const record = await createUploadSessionRecord({
    address: input.address,
    chainId: input.chainId,
    domain,
    origin,
    userAgentHash: hashUserAgent(input.req.headers.get("user-agent")),
    ttlSeconds: getUploadSessionTtlSeconds(),
  });

  return {
    session: {
      id: record.id,
      sub: record.address,
      chainId: record.chainId,
      version: record.version,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      lastUsedAt: record.lastUsedAt,
    } satisfies UploadSession,
    token: createSignedSessionToken(record.id),
  };
}

/**
 * @notice 从请求中读取并验证上传会话。
 * @param req 当前请求对象。
 * @returns 若会话合法则返回业务会话结构，否则返回 `null`。
 */
export async function readUploadSession(
  req: NextRequest
): Promise<UploadSession | null> {
  const sessionId = readSignedSessionId(req);

  if (!sessionId) {
    return null;
  }

  const record = await getUploadSessionRecord(sessionId);

  if (!record) {
    return null;
  }

  const { domain, origin } = getRequestSite(req);
  const userAgentHash = hashUserAgent(req.headers.get("user-agent"));
  const isCurrentVersion = await isUploadSessionVersionCurrent(record);

  if (
    record.domain !== domain ||
    record.origin !== origin ||
    record.userAgentHash !== userAgentHash ||
    !isCurrentVersion
  ) {
    await revokeUploadSession(record.id);
    return null;
  }

  const updatedRecord = await touchUploadSessionRecord(
    record,
    getUploadSessionTtlSeconds()
  );

  return {
    id: updatedRecord.id,
    sub: updatedRecord.address,
    chainId: updatedRecord.chainId,
    version: updatedRecord.version,
    createdAt: updatedRecord.createdAt,
    expiresAt: updatedRecord.expiresAt,
    lastUsedAt: updatedRecord.lastUsedAt,
  };
}

/**
 * @notice 根据请求中的 Cookie 撤销上传会话。
 * @param req 当前请求对象。
 * @returns 当前函数不返回值，仅在存在会话时执行撤销。
 */
export async function revokeUploadSessionFromRequest(req: NextRequest) {
  const sessionId = readSignedSessionId(req);

  if (!sessionId) {
    return;
  }

  await revokeUploadSession(sessionId);
}

/**
 * @notice 向响应写入上传会话 Cookie。
 * @param res 当前响应对象。
 * @param token 已签名的会话 token。
 * @returns 当前函数不返回值，仅负责设置 Cookie。
 */
export function setUploadSessionCookie(res: NextResponse, token: string) {
  res.cookies.set({
    name: uploadSessionCookieName,
    value: token,
    httpOnly: true,
    secure: getServerEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getUploadSessionTtlSeconds(),
  });
}

/**
 * @notice 清除上传会话 Cookie。
 * @param res 当前响应对象。
 * @returns 当前函数不返回值，仅负责覆盖并失效 Cookie。
 */
export function clearUploadSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: uploadSessionCookieName,
    value: "",
    httpOnly: true,
    secure: getServerEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
