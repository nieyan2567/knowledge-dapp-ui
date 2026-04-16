import { NextRequest, NextResponse } from "next/server";
/**
 * 模块说明：节点申请撤销接口，负责撤销已通过的节点并把对应 enode 从 allowlist 移除。
 */
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { reviewNodeRequestSchema } from "@/lib/admin/schemas";
import { BesuAdminRpcError } from "@/lib/besu-admin/client";
import { getNodesAllowlist, removeNodesFromAllowlist } from "@/lib/besu-admin/permissioning";
import { captureServerException } from "@/lib/observability/server";
import { requireAdminRequest } from "@/server/admin/auth";
import { AdminStoreConflictError, AdminStoreNotFoundError, getNodeRequestById, revokeNodeRequest } from "@/server/admin/store";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 撤销指定节点申请。
 * @param req 携带撤销参数的请求对象。
 * @param context 包含节点申请 ID 的路由上下文。
 * @returns 包含撤销后节点申请记录的 JSON 响应。
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:node-requests:revoke"]);
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });

  const authResult = await requireAdminRequest(req);
  if (!authResult.ok) return authResult.response;

  const bodyResult = await parseJsonBody(req, reviewNodeRequestSchema, "审批参数无效");
  if (!bodyResult.ok) return bodyResult.response;

  const { id } = await context.params;

  try {
    const request = await getNodeRequestById(id);
    if (!request) return NextResponse.json({ error: "节点申请不存在" }, { status: 404 });

    const allowlist = await getNodesAllowlist();
    const isAllowlisted = allowlist.some((item) => item.toLowerCase() === request.enode.toLowerCase());
    if (isAllowlisted) await removeNodesFromAllowlist([request.enode]);

    const revokedRequest = await revokeNodeRequest({
      requestId: id,
      reviewedBy: authResult.value.address,
      reviewComment: bodyResult.value.reviewComment,
    });

    return NextResponse.json(revokedRequest, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminStoreNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof AdminStoreConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof BesuAdminRpcError) {
      return NextResponse.json({ error: `Besu 节点白名单移除失败：${error.message}` }, { status: 502 });
    }

    await captureServerException("Failed to revoke node request", {
      source: "api.admin.node-requests.revoke",
      severity: "error",
      request: req,
      error,
      context: { requestId: id, reviewedBy: authResult.value.address },
    });

    return NextResponse.json({ error: "节点撤销失败，请稍后重试" }, { status: 500 });
  }
}
