import { NextRequest, NextResponse } from "next/server";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { getNodeRequestRuntimeStatus } from "@/server/admin/node-runtime-status";
import { getNodeRequestById } from "@/server/admin/store";
import { readAdminRequestContext } from "@/server/admin/auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rateLimit = await enforceApiRateLimits(req.headers, [
    "admin:node-requests:status",
  ]);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });
  }

  const requestContext = await readAdminRequestContext(req);
  if (!requestContext.address) {
    return NextResponse.json(
      { error: "请先完成钱包签名验证" },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const requestRecord = await getNodeRequestById(id);

  if (!requestRecord) {
    return NextResponse.json({ error: "节点申请不存在" }, { status: 404 });
  }

  const isOwner =
    requestRecord.applicantAddress.toLowerCase() ===
    requestContext.address.toLowerCase();

  if (!requestContext.isAdmin && !isOwner) {
    return NextResponse.json(
      { error: "你无权查看该节点状态" },
      { status: 403 }
    );
  }

  const runtimeStatus = await getNodeRequestRuntimeStatus(requestRecord);

  return NextResponse.json(runtimeStatus, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
