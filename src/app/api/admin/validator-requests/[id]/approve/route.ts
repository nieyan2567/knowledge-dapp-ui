import { NextRequest, NextResponse } from "next/server";
/**
 * 模块说明：验证者申请通过接口，负责批准验证者申请并向 Besu 发起加入 Validator 集的投票。
 */
import { reviewValidatorRequestSchema } from "@/lib/admin/schemas";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { BesuAdminRpcError } from "@/lib/besu-admin/client";
import { getNodesAllowlist } from "@/lib/besu-admin/permissioning";
import { proposeValidatorVote } from "@/lib/besu-admin/validators";
import { captureServerException } from "@/lib/observability/server";
import { requireAdminRequest } from "@/server/admin/auth";
import { AdminStoreConflictError, AdminStoreNotFoundError, getNodeRequestById, getValidatorRequestById, reviewValidatorRequest } from "@/server/admin/store";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 批准指定验证者申请。
 * @param req 携带审批参数的请求对象。
 * @param context 包含验证者申请 ID 的路由上下文。
 * @returns 包含审批后验证者申请记录的 JSON 响应。
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:validator-requests:approve"]);
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });

  const authResult = await requireAdminRequest(req);
  if (!authResult.ok) return authResult.response;

  const bodyResult = await parseJsonBody(req, reviewValidatorRequestSchema, "审批参数无效");
  if (!bodyResult.ok) return bodyResult.response;

  const { id } = await context.params;

  try {
    const request = await getValidatorRequestById(id);
    if (!request) return NextResponse.json({ error: "Validator 申请不存在" }, { status: 404 });

    const nodeRequest = await getNodeRequestById(request.nodeRequestId);
    if (!nodeRequest || nodeRequest.status !== "approved") {
      return NextResponse.json({ error: "对应的普通节点未处于已批准状态，不能发起 Validator 投票" }, { status: 409 });
    }

    const allowlist = await getNodesAllowlist();
    const isAllowlisted = allowlist.some((item) => item.toLowerCase() === request.nodeEnode.toLowerCase());
    if (!isAllowlisted) {
      return NextResponse.json({ error: "对应节点尚未进入 allowlist，不能发起 Validator 投票" }, { status: 409 });
    }

    await proposeValidatorVote(request.validatorAddress, true);

    const reviewedRequest = await reviewValidatorRequest({
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
      return NextResponse.json({ error: `Besu validator 投票发起失败：${error.message}` }, { status: 502 });
    }

    await captureServerException("Failed to approve validator request", {
      source: "api.admin.validator-requests.approve",
      severity: "error",
      request: req,
      error,
      context: { requestId: id, reviewedBy: authResult.value.address },
    });

    return NextResponse.json({ error: "Validator 申请审批失败，请稍后重试" }, { status: 500 });
  }
}
