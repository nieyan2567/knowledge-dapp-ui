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
  return getServerEnv().UPLOAD_AUTH_SECRET || "knowledge-dapp-dev-upload-secret";
}

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

export async function revokeUploadSessionFromRequest(req: NextRequest) {
  const sessionId = readSignedSessionId(req);

  if (!sessionId) {
    return;
  }

  await revokeUploadSession(sessionId);
}

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
