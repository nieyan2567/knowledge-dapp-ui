import { NextRequest, NextResponse } from "next/server";

import {
  clearUploadSessionCookie,
  readUploadSession,
  revokeUploadSessionFromRequest,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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
  await revokeUploadSessionFromRequest(req);

  const response = NextResponse.json({ authenticated: false });
  clearUploadSessionCookie(response);
  return response;
}
