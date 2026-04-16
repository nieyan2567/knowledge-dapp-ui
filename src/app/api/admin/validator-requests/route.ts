import { NextRequest, NextResponse } from "next/server";
/**
 * 模块说明：验证者申请接口，负责列出验证者申请、可用节点候选，并支持创建新申请。
 */
import { createValidatorRequestSchema } from "@/lib/admin/schemas";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { BesuAdminRpcError } from "@/lib/besu-admin/client";
import { getNodesAllowlist } from "@/lib/besu-admin/permissioning";
import { getValidatorsByBlockNumber } from "@/lib/besu-admin/validators";
import { captureServerException } from "@/lib/observability/server";
import { AdminStoreConflictError, createValidatorRequest, getNodeRequestById, listApprovedNodeRequests, listApprovedNodeRequestsByApplicant, listValidatorRequests, listValidatorRequestsByApplicant } from "@/server/admin/store";
import { readAdminRequestContext, requireAuthenticatedRequest } from "@/server/admin/auth";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 返回验证者申请列表以及当前仍可提交申请的节点候选。
 * @param req 用于鉴权和限流的请求对象。
 * @returns 包含验证者申请与候选节点信息的 JSON 响应。
 */
export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:validator-requests:list"]);
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });

  const context = await readAdminRequestContext(req);
  const requests = !context.address ? [] : context.isAdmin ? await listValidatorRequests() : await listValidatorRequestsByApplicant(context.address);
  const approvedNodes = !context.address ? [] : context.isAdmin ? await listApprovedNodeRequests() : await listApprovedNodeRequestsByApplicant(context.address);

  let eligibleNodes = approvedNodes;
  let eligibleNodesError: string | null = null;
  let currentValidators: `0x${string}`[] = [];
  let validatorsError: string | null = null;

  try {
    const allowlist = await getNodesAllowlist();
    const allowlistSet = new Set(allowlist.map((item) => item.toLowerCase()));
    eligibleNodes = approvedNodes.filter((node) => allowlistSet.has(node.enode.toLowerCase()));
  } catch (error) {
    eligibleNodesError = error instanceof BesuAdminRpcError ? error.message : "Allowlist 读取失败";
    eligibleNodes = [];
  }

  try {
    currentValidators = await getValidatorsByBlockNumber("latest");
  } catch (error) {
    validatorsError = error instanceof BesuAdminRpcError ? error.message : "Validator 列表读取失败";
  }

  return NextResponse.json(
    { currentAddress: context.address, isAdmin: context.isAdmin, requests, eligibleNodes, eligibleNodesError, currentValidators, validatorsError },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * 为当前认证用户创建新的验证者申请。
 * @param req 携带验证者申请参数的请求对象。
 * @returns 包含新建验证者申请记录的 JSON 响应。
 */
export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:validator-requests:create"]);
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });

  const authResult = await requireAuthenticatedRequest(req);
  if (!authResult.ok) return authResult.response;

  const bodyResult = await parseJsonBody(req, createValidatorRequestSchema, "Validator 申请参数无效");
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const nodeRequest = await getNodeRequestById(bodyResult.value.nodeRequestId);
    if (!nodeRequest) return NextResponse.json({ error: "所选普通节点不存在" }, { status: 404 });
    if (nodeRequest.status !== "approved") {
      return NextResponse.json({ error: "只有已批准的普通节点才能提交 Validator 申请" }, { status: 409 });
    }

    const allowlist = await getNodesAllowlist();
    const isAllowlisted = allowlist.some((item) => item.toLowerCase() === nodeRequest.enode.toLowerCase());
    if (!isAllowlisted) {
      return NextResponse.json({ error: "只有仍在 allowlist 中的普通节点才能提交 Validator 申请" }, { status: 409 });
    }

    if (nodeRequest.applicantAddress.toLowerCase() !== authResult.value.address.toLowerCase()) {
      return NextResponse.json({ error: "只能为当前钱包名下的普通节点提交 Validator 申请" }, { status: 403 });
    }

    const request = await createValidatorRequest({
      applicantAddress: authResult.value.address,
      nodeRequestId: bodyResult.value.nodeRequestId,
      validatorAddress: bodyResult.value.validatorAddress,
      description: bodyResult.value.description,
    });

    return NextResponse.json(request, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminStoreConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    await captureServerException("Failed to create validator request", {
      source: "api.admin.validator-requests.create",
      severity: "error",
      request: req,
      error,
      context: { applicantAddress: authResult.value.address },
    });

    return NextResponse.json({ error: "Validator 申请创建失败，请稍后重试" }, { status: 500 });
  }
}
