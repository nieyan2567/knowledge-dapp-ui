import { getAddress, verifyMessage } from "viem";
import { NextRequest, NextResponse } from "next/server";

import {
  parseJsonObject,
  parseRequiredString,
} from "@/lib/api-validation";
import { buildUploadAuthMessage } from "@/lib/auth/message";
import { takeUploadAuthChallenge } from "@/lib/auth/nonce-store";
import { getRequestSite } from "@/lib/auth/request";
import {
  createUploadSessionToken,
  setUploadSessionCookie,
} from "@/lib/auth/session";
import { knowledgeChain } from "@/lib/chains";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const bodyResult = await parseJsonObject(req);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const addressResult = parseRequiredString(bodyResult.value.address, "缺少钱包地址", {
    maxLength: 128,
  });
  if (!addressResult.ok) {
    return addressResult.response;
  }

  const nonceResult = parseRequiredString(bodyResult.value.nonce, "缺少 nonce", {
    maxLength: 256,
  });
  if (!nonceResult.ok) {
    return nonceResult.response;
  }

  const signatureResult = parseRequiredString(bodyResult.value.signature, "签名格式无效", {
    maxLength: 256,
    pattern: /^0x[0-9a-fA-F]+$/,
  });
  if (!signatureResult.ok) {
    return signatureResult.response;
  }

  let address: `0x${string}`;

  try {
    address = getAddress(addressResult.value);
  } catch {
    return NextResponse.json({ error: "钱包地址格式无效" }, { status: 400 });
  }

  const challenge = await takeUploadAuthChallenge(nonceResult.value);

  if (!challenge) {
    return NextResponse.json({ error: "签名挑战已过期或已被使用" }, { status: 401 });
  }

  const { domain, origin } = getRequestSite(req);

  if (
    challenge.domain !== domain ||
    challenge.origin !== origin ||
    challenge.chainId !== knowledgeChain.id
  ) {
    return NextResponse.json({ error: "签名挑战与当前站点不匹配" }, { status: 401 });
  }

  const isValidSignature = await verifyMessage({
    address,
    message: buildUploadAuthMessage(challenge, address),
    signature: signatureResult.value as `0x${string}`,
  });

  if (!isValidSignature) {
    return NextResponse.json({ error: "钱包签名无效" }, { status: 401 });
  }

  const response = NextResponse.json({
    authenticated: true,
    address,
    chainId: challenge.chainId,
  });

  setUploadSessionCookie(
    response,
    createUploadSessionToken(address, challenge.chainId)
  );

  return response;
}
