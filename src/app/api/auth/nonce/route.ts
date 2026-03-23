import { NextRequest, NextResponse } from "next/server";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { createUploadAuthChallenge } from "@/lib/auth/nonce-store";
import { getRequestSite } from "@/lib/auth/request";
import { knowledgeChain } from "@/lib/chains";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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
