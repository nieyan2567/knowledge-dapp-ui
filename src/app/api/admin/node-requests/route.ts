import { NextRequest, NextResponse } from "next/server";
import { createNodeRequestSchema } from "@/lib/admin/schemas";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { captureServerException } from "@/lib/observability/server";
import { AdminStoreConflictError, createNodeRequest, listNodeRequests, listNodeRequestsByApplicant } from "@/server/admin/store";
import { readAdminRequestContext, requireAuthenticatedRequest } from "@/server/admin/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:node-requests:list"]);
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });

  const context = await readAdminRequestContext(req);
  const requests = !context.address ? [] : context.isAdmin ? await listNodeRequests() : await listNodeRequestsByApplicant(context.address);

  return NextResponse.json({ currentAddress: context.address, isAdmin: context.isAdmin, requests }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:node-requests:create"]);
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });

  const authResult = await requireAuthenticatedRequest(req);
  if (!authResult.ok) return authResult.response;

  const bodyResult = await parseJsonBody(req, createNodeRequestSchema, "节点申请参数无效");
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const request = await createNodeRequest({
      applicantAddress: authResult.value.address,
      nodeName: bodyResult.value.nodeName,
      serverHost: bodyResult.value.serverHost,
      nodeRpcUrl: bodyResult.value.nodeRpcUrl,
      enode: bodyResult.value.enode,
      description: bodyResult.value.description,
    });

    return NextResponse.json(request, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminStoreConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    await captureServerException("Failed to create node request", {
      source: "api.admin.node-requests.create",
      severity: "error",
      request: req,
      error,
      context: { applicantAddress: authResult.value.address },
    });

    return NextResponse.json({ error: "节点申请创建失败，请稍后重试" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
