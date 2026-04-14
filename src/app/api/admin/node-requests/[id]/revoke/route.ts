import { NextRequest, NextResponse } from "next/server";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { reviewNodeRequestSchema } from "@/lib/admin/schemas";
import { BesuAdminRpcError } from "@/lib/besu-admin/client";
import { getNodesAllowlist, removeNodesFromAllowlist } from "@/lib/besu-admin/permissioning";
import { captureServerException } from "@/lib/observability/server";
import { requireAdminRequest } from "@/server/admin/auth";
import { AdminStoreConflictError, AdminStoreNotFoundError, getNodeRequestById, revokeNodeRequest } from "@/server/admin/store";

export const runtime = "nodejs";

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
