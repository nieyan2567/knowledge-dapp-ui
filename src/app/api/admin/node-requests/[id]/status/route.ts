import { NextRequest, NextResponse } from "next/server";

/**
 * 模块说明：节点运行状态接口，负责查询指定节点申请对应节点的实时运行状态。
 */
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { getNodeRequestRuntimeStatus } from "@/server/admin/node-runtime-status";
import { getNodeRequestById } from "@/server/admin/store";
import { readAdminRequestContext } from "@/server/admin/auth";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 返回指定节点申请对应的运行状态。
 * @param req 用于鉴权和限流的请求对象。
 * @param context 包含节点申请 ID 的路由上下文。
 * @returns 包含运行状态快照的 JSON 响应。
 */
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
