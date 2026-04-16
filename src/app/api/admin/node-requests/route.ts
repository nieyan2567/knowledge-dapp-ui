import { NextRequest, NextResponse } from "next/server";
/**
 * 模块说明：节点申请接口，负责列出当前可见节点申请并支持新建节点申请记录。
 */
import { createNodeRequestSchema } from "@/lib/admin/schemas";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { captureServerException } from "@/lib/observability/server";
import { AdminStoreConflictError, createNodeRequest, listNodeRequests, listNodeRequestsByApplicant } from "@/server/admin/store";
import { readAdminRequestContext, requireAuthenticatedRequest } from "@/server/admin/auth";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 返回当前调用方可见的节点申请列表。
 * @param req 用于鉴权和限流的请求对象。
 * @returns 包含节点申请记录的 JSON 响应。
 */
export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:node-requests:list"]);
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });

  const context = await readAdminRequestContext(req);
  const requests = !context.address ? [] : context.isAdmin ? await listNodeRequests() : await listNodeRequestsByApplicant(context.address);

  return NextResponse.json({ currentAddress: context.address, isAdmin: context.isAdmin, requests }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * 为当前认证用户创建新的节点申请记录。
 * @param req 携带节点申请参数的请求对象。
 * @returns 包含新建节点申请记录的 JSON 响应。
 */
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
