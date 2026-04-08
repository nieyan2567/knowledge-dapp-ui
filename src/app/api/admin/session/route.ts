import { NextRequest, NextResponse } from "next/server";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { readAdminRequestContext } from "@/server/admin/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:session"]);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });
  }

  const context = await readAdminRequestContext(req);

  return NextResponse.json(
    {
      authenticated: !!context.address,
      address: context.address,
      isAdmin: context.isAdmin,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
