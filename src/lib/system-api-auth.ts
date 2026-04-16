/**
 * @notice System API 鉴权辅助工具。
 * @dev 提供 Bearer Token 解析、安全比较以及系统 API Token 读取逻辑。
 */
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

/**
 * @notice 获取当前服务端用于系统 API 的鉴权令牌。
 * @returns 首选 `SYSTEM_API_TOKEN`，若未配置则回退到 `REBALANCE_API_TOKEN`。
 */
export function getSystemApiToken() {
  const env = getServerEnv();
  return env.SYSTEM_API_TOKEN ?? env.REBALANCE_API_TOKEN;
}

/**
 * @notice 校验请求是否携带合法的系统 API Bearer Token。
 * @param req 当前 Next 请求对象。
 * @param token 服务端期望的令牌值。
 * @returns 若请求头中的 Bearer Token 与期望值一致则返回 `true`。
 */
export function isAuthorizedSystemRequest(req: NextRequest, token: string) {
  const providedToken = readBearerToken(req);
  return !!providedToken && safeTokenEquals(providedToken, token);
}
