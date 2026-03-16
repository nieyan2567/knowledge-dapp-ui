import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

const uploadSessionCookieName = "knowledge_upload_session";
const uploadSessionTtlSeconds = Number(
  process.env.UPLOAD_AUTH_SESSION_TTL_SECONDS || "86400"
);

type UploadSessionPayload = {
  sub: `0x${string}`;
  chainId: number;
  iat: number;
  exp: number;
  v: 1;
};

function getUploadSessionSecret() {
  if (process.env.UPLOAD_AUTH_SECRET) {
    return process.env.UPLOAD_AUTH_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("UPLOAD_AUTH_SECRET must be configured in production");
  }

  return "knowledge-dapp-dev-upload-secret";
}

function sign(value: string) {
  return createHmac("sha256", getUploadSessionSecret())
    .update(value)
    .digest("base64url");
}

function encodePayload(payload: UploadSessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string) {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    return JSON.parse(json) as UploadSessionPayload;
  } catch {
    return null;
  }
}

export function createUploadSessionToken(
  address: `0x${string}`,
  chainId: number
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: UploadSessionPayload = {
    sub: address,
    chainId,
    iat: issuedAt,
    exp: issuedAt + uploadSessionTtlSeconds,
    v: 1,
  };

  const encodedPayload = encodePayload(payload);
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function readUploadSession(req: NextRequest) {
  const token = req.cookies.get(uploadSessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  const payload = decodePayload(encodedPayload);

  if (!payload || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function setUploadSessionCookie(
  res: NextResponse,
  token: string
) {
  res.cookies.set({
    name: uploadSessionCookieName,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: uploadSessionTtlSeconds,
  });
}

export function clearUploadSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: uploadSessionCookieName,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
