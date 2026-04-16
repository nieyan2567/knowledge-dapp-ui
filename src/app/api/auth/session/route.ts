/**
 * 模块说明：上传会话接口，负责查询当前上传登录态并支持显式注销上传会话。
 */
import { NextRequest, NextResponse } from "next/server";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import {
  clearUploadSessionCookie,
  readUploadSession,
  revokeUploadSessionFromRequest,
} from "@/lib/auth/session";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 读取当前请求携带的上传会话。
 * @param req 可能携带上传会话 Cookie 的请求对象。
 * @returns 描述当前上传会话状态的 JSON 响应。
 */
export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["auth:session"]);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });
  }

  const session = await readUploadSession(req);

  if (!session) {
    const response = NextResponse.json(
      { authenticated: false },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
    clearUploadSessionCookie(response);
    return response;
  }

  return NextResponse.json(
    {
      authenticated: true,
      address: session.sub,
      chainId: session.chainId,
      sessionVersion: session.version,
      expiresAt: session.expiresAt,
      lastUsedAt: session.lastUsedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

/**
 * 注销当前上传会话并清理会话 Cookie。
 * @param req 需要被撤销上传会话的请求对象。
 * @returns 表示当前请求已退出上传鉴权状态的 JSON 响应。
 */
export async function DELETE(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["auth:logout"]);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });
  }

  await revokeUploadSessionFromRequest(req);

  const response = NextResponse.json({ authenticated: false });
  clearUploadSessionCookie(response);
  return response;
}
