import "server-only";

import type { NextRequest } from "next/server";

export function getRequestSite(req: NextRequest) {
  const domain =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    req.nextUrl.host;
  const protocol =
    req.headers.get("x-forwarded-proto") ??
    req.nextUrl.protocol.replace(":", "");
  const origin = `${protocol}://${domain}`;

  return { domain, origin };
}
