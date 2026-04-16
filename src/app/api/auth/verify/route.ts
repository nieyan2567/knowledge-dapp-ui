/**
 * 模块说明：上传鉴权校验接口，负责验证钱包签名并建立短期上传会话。
 */
import { getAddress, verifyMessage } from "viem";
import { NextRequest, NextResponse } from "next/server";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { signedRequestBodySchema } from "@/lib/api-schemas";
import { buildUploadAuthMessage } from "@/lib/auth/message";
import { takeUploadAuthChallenge } from "@/lib/auth/nonce-store";
import { getRequestSite } from "@/lib/auth/request";
import {
  createUploadSession,
  setUploadSessionCookie,
} from "@/lib/auth/session";
import { getKnowledgeChain } from "@/lib/chains";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 校验上传签名挑战并建立上传会话。
 * @param req 携带签名载荷的请求对象。
 * @returns 描述当前上传会话的 JSON 响应。
 */
export async function POST(req: NextRequest) {
  const knowledgeChain = getKnowledgeChain();
  const rateLimit = await enforceApiRateLimits(req.headers, ["auth:verify"]);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: rateLimit.error },
      { status: rateLimit.status }
    );
  }

  const bodyResult = await parseJsonBody(req, signedRequestBodySchema);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const body = bodyResult.value;

  let address: `0x${string}`;

  try {
    address = getAddress(body.address);
  } catch {
    return NextResponse.json({ error: "钱包地址格式无效" }, { status: 400 });
  }

  const challenge = await takeUploadAuthChallenge(body.nonce);

  if (!challenge) {
    return NextResponse.json(
      { error: "签名挑战已过期或已被使用" },
      { status: 401 }
    );
  }

  const { domain, origin } = getRequestSite(req);

  if (
    challenge.domain !== domain ||
    challenge.origin !== origin ||
    challenge.chainId !== knowledgeChain.id
  ) {
    return NextResponse.json(
      { error: "签名挑战与当前站点不匹配" },
      { status: 401 }
    );
  }

  const isValidSignature = await verifyMessage({
    address,
    message: buildUploadAuthMessage(challenge, address),
    signature: body.signature as `0x${string}`,
  });

  if (!isValidSignature) {
    return NextResponse.json({ error: "钱包签名无效" }, { status: 401 });
  }

  const { session, token } = await createUploadSession({
    address,
    chainId: challenge.chainId,
    req,
  });

  const response = NextResponse.json({
    authenticated: true,
    address,
    chainId: challenge.chainId,
    sessionVersion: session.version,
    expiresAt: session.expiresAt,
  });

  setUploadSessionCookie(response, token);

  return response;
}
