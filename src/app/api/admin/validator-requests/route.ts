import { NextRequest, NextResponse } from "next/server";
import { createValidatorRequestSchema } from "@/lib/admin/schemas";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { BesuAdminRpcError } from "@/lib/besu-admin/client";
import { getNodesAllowlist } from "@/lib/besu-admin/permissioning";
import { getValidatorsByBlockNumber } from "@/lib/besu-admin/validators";
import { captureServerException } from "@/lib/observability/server";
import { AdminStoreConflictError, createValidatorRequest, getNodeRequestById, listApprovedNodeRequests, listApprovedNodeRequestsByApplicant, listValidatorRequests, listValidatorRequestsByApplicant } from "@/server/admin/store";
import { readAdminRequestContext, requireAuthenticatedRequest } from "@/server/admin/auth";

export const runtime = "nodejs";

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
