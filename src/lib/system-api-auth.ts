import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env";

function readBearerToken(req: NextRequest) {
  const authorization = req.headers.get("authorization")?.trim();
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function safeTokenEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getSystemApiToken() {
  const env = getServerEnv();
  return env.SYSTEM_API_TOKEN ?? env.REBALANCE_API_TOKEN;
}

export function isAuthorizedSystemRequest(req: NextRequest, token: string) {
  const providedToken = readBearerToken(req);
  return !!providedToken && safeTokenEquals(providedToken, token);
}
