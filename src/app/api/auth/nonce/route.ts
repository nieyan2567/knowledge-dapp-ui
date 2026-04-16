/**
 * 模块说明：上传鉴权 nonce 接口，负责为前端生成与当前站点和链环境绑定的签名挑战。
 */
import { NextRequest, NextResponse } from "next/server";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { createUploadAuthChallenge } from "@/lib/auth/nonce-store";
import { getRequestSite } from "@/lib/auth/request";
import { getKnowledgeChain } from "@/lib/chains";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 为当前站点签发新的上传鉴权挑战。
 * @param req 用于限流与站点来源绑定的请求对象。
 * @returns 包含 nonce 挑战信息的 JSON 响应。
 */
export async function GET(req: NextRequest) {
  const knowledgeChain = getKnowledgeChain();
  const rateLimit = await enforceApiRateLimits(req.headers, ["auth:nonce"]);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });
  }

  const { domain, origin } = getRequestSite(req);

  const challenge = await createUploadAuthChallenge({
    domain,
    origin,
    chainId: knowledgeChain.id,
  });

  return NextResponse.json(challenge, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
