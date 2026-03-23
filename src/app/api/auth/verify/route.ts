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
import { knowledgeChain } from "@/lib/chains";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
