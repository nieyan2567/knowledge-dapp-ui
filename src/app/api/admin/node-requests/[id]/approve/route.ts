import { NextRequest, NextResponse } from "next/server";
/**
 * 模块说明：节点申请通过接口，负责批准节点申请并同步把对应 enode 加入 Besu allowlist。
 */
import { reviewNodeRequestSchema } from "@/lib/admin/schemas";
import { addNodesToAllowlist } from "@/lib/besu-admin/permissioning";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { BesuAdminRpcError } from "@/lib/besu-admin/client";
import { captureServerException } from "@/lib/observability/server";
import { requireAdminRequest } from "@/server/admin/auth";
import { AdminStoreConflictError, AdminStoreNotFoundError, getNodeRequestById, reviewNodeRequest } from "@/server/admin/store";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 批准指定节点申请。
 * @param req 携带审批参数的请求对象。
 * @param context 包含节点申请 ID 的路由上下文。
 * @returns 包含审批后节点申请记录的 JSON 响应。
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:node-requests:approve"]);
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });

  const authResult = await requireAdminRequest(req);
  if (!authResult.ok) return authResult.response;

  const bodyResult = await parseJsonBody(req, reviewNodeRequestSchema, "审批参数无效");
  if (!bodyResult.ok) return bodyResult.response;

  const { id } = await context.params;

  try {
    const request = await getNodeRequestById(id);
    if (!request) return NextResponse.json({ error: "节点申请不存在" }, { status: 404 });

    await addNodesToAllowlist([request.enode]);

    const reviewedRequest = await reviewNodeRequest({
      requestId: id,
      status: "approved",
      reviewedBy: authResult.value.address,
      reviewComment: bodyResult.value.reviewComment,
    });

    return NextResponse.json(reviewedRequest, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminStoreNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof AdminStoreConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof BesuAdminRpcError) {
      return NextResponse.json({ error: `Besu 节点白名单更新失败：${error.message}` }, { status: 502 });
    }

    await captureServerException("Failed to approve node request", {
      source: "api.admin.node-requests.approve",
      severity: "error",
      request: req,
      error,
      context: { requestId: id, reviewedBy: authResult.value.address },
    });

    return NextResponse.json({ error: "节点申请审批失败，请稍后重试" }, { status: 500 });
  }
}
