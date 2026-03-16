import { getAddress, verifyMessage } from "viem";
import { NextRequest, NextResponse } from "next/server";

import { buildUploadAuthMessage } from "@/lib/auth/message";
import { takeUploadAuthChallenge } from "@/lib/auth/nonce-store";
import { getRequestSite } from "@/lib/auth/request";
import {
  createUploadSessionToken,
  setUploadSessionCookie,
} from "@/lib/auth/session";
import { knowledgeChain } from "@/lib/chains";

export const runtime = "nodejs";

type VerifyUploadAuthBody = {
  address?: string;
  nonce?: string;
  signature?: string;
};

export async function POST(req: NextRequest) {
  let body: VerifyUploadAuthBody;

  try {
    body = (await req.json()) as VerifyUploadAuthBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!body.address || !body.nonce || !body.signature) {
    return NextResponse.json(
      { error: "Missing address, nonce, or signature" },
      { status: 400 }
    );
  }

  let address: `0x${string}`;

  try {
    address = getAddress(body.address);
  } catch {
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400 }
    );
  }

  const challenge = await takeUploadAuthChallenge(body.nonce);

  if (!challenge) {
    return NextResponse.json(
      { error: "Challenge expired or already used" },
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
      { error: "Challenge does not match current site" },
      { status: 401 }
    );
  }

  const isValidSignature = await verifyMessage({
    address,
    message: buildUploadAuthMessage(challenge, address),
    signature: body.signature as `0x${string}`,
  });

  if (!isValidSignature) {
    return NextResponse.json(
      { error: "Invalid wallet signature" },
      { status: 401 }
    );
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
