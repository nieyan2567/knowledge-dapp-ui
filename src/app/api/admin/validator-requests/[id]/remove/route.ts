import { NextRequest, NextResponse } from "next/server";
/**
 * 模块说明：验证者移除投票接口，负责为已生效验证者发起移除投票。
 */
import { reviewValidatorRequestSchema } from "@/lib/admin/schemas";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { BesuAdminRpcError } from "@/lib/besu-admin/client";
import { getValidatorsByBlockNumber, proposeValidatorVote } from "@/lib/besu-admin/validators";
import { captureServerException } from "@/lib/observability/server";
import { requireAdminRequest } from "@/server/admin/auth";
import { AdminStoreNotFoundError, getValidatorRequestById, logAdminAction } from "@/server/admin/store";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 为指定验证者发起移除投票。
 * @param req 携带移除说明的请求对象。
 * @param context 包含验证者申请 ID 的路由上下文。
 * @returns 表示移除投票已成功发起的 JSON 响应。
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:validator-requests:remove"]);
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });

  const authResult = await requireAdminRequest(req);
  if (!authResult.ok) return authResult.response;

  const bodyResult = await parseJsonBody(req, reviewValidatorRequestSchema, "审批参数无效");
  if (!bodyResult.ok) return bodyResult.response;

  const { id } = await context.params;

  try {
    const request = await getValidatorRequestById(id);
    if (!request) throw new AdminStoreNotFoundError("Validator 申请不存在");

    if (request.status !== "approved") {
      return NextResponse.json({ error: "只有已批准的 Validator 申请才能发起移除投票" }, { status: 409 });
    }

    const currentValidators = await getValidatorsByBlockNumber("latest");
    const isActiveValidator = currentValidators.some((item) => item.toLowerCase() === request.validatorAddress.toLowerCase());
    if (!isActiveValidator) {
      return NextResponse.json({ error: "该地址当前不在 Validator 集合中，无需发起移除投票" }, { status: 409 });
    }

    await proposeValidatorVote(request.validatorAddress, false);
    await logAdminAction({
      actorAddress: authResult.value.address,
      action: "validator_removal_vote_proposed",
      targetId: request.id,
      success: true,
      detail: bodyResult.value.reviewComment,
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminStoreNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof BesuAdminRpcError) {
      return NextResponse.json({ error: `Besu validator 移除投票发起失败：${error.message}` }, { status: 502 });
    }

    await captureServerException("Failed to initiate validator removal vote", {
      source: "api.admin.validator-requests.remove",
      severity: "error",
      request: req,
      error,
      context: { requestId: id, reviewedBy: authResult.value.address },
    });

    return NextResponse.json({ error: "Validator 移除投票发起失败，请稍后重试" }, { status: 500 });
  }
}
