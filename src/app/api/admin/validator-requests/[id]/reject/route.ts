import { NextRequest, NextResponse } from "next/server";
import { reviewValidatorRequestSchema } from "@/lib/admin/schemas";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { captureServerException } from "@/lib/observability/server";
import { requireAdminRequest } from "@/server/admin/auth";
import { AdminStoreConflictError, AdminStoreNotFoundError, reviewValidatorRequest } from "@/server/admin/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:validator-requests:reject"]);
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });

  const authResult = await requireAdminRequest(req);
  if (!authResult.ok) return authResult.response;

  const bodyResult = await parseJsonBody(req, reviewValidatorRequestSchema, "审批参数无效");
  if (!bodyResult.ok) return bodyResult.response;

  const { id } = await context.params;

  try {
    const reviewedRequest = await reviewValidatorRequest({
      requestId: id,
      status: "rejected",
      reviewedBy: authResult.value.address,
      reviewComment: bodyResult.value.reviewComment,
    });

    return NextResponse.json(reviewedRequest, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminStoreNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof AdminStoreConflictError) return NextResponse.json({ error: error.message }, { status: 409 });

    await captureServerException("Failed to reject validator request", {
      source: "api.admin.validator-requests.reject",
      severity: "error",
      request: req,
      error,
      context: { requestId: id, reviewedBy: authResult.value.address },
    });

    return NextResponse.json({ error: "Validator 申请拒绝失败，请稍后重试" }, { status: 500 });
  }
}
