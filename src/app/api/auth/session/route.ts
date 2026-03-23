import { NextRequest, NextResponse } from "next/server";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import {
  clearUploadSessionCookie,
  readUploadSession,
  revokeUploadSessionFromRequest,
} from "@/lib/auth/session";

export const runtime = "nodejs";

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
