import { NextRequest, NextResponse } from "next/server";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { BesuAdminRpcError } from "@/lib/besu-admin/client";
import { getNodesAllowlist } from "@/lib/besu-admin/permissioning";
import { getValidatorsByBlockNumber } from "@/lib/besu-admin/validators";
import { requireAdminRequest } from "@/server/admin/auth";
import { listNodeRequests, listRecentAdminActionLogs, listValidatorRequests } from "@/server/admin/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:overview"]);
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });

  const authResult = await requireAdminRequest(req);
  if (!authResult.ok) return authResult.response;

  try {
    const [nodeRequests, validatorRequests, logs, allowlist, currentValidators] = await Promise.all([
      listNodeRequests(),
      listValidatorRequests(),
      listRecentAdminActionLogs(8),
      getNodesAllowlist(),
      getValidatorsByBlockNumber("latest"),
    ]);

    return NextResponse.json(
      {
        pendingNodeRequestCount: nodeRequests.filter((request) => request.status === "pending").length,
        approvedNodeRequestCount: nodeRequests.filter((request) => request.status === "approved").length,
        revokedNodeRequestCount: nodeRequests.filter((request) => request.status === "revoked").length,
        rejectedNodeRequestCount: nodeRequests.filter((request) => request.status === "rejected").length,
        pendingValidatorRequestCount: validatorRequests.filter((request) => request.status === "pending").length,
        approvedValidatorRequestCount: validatorRequests.filter((request) => request.status === "approved").length,
        rejectedValidatorRequestCount: validatorRequests.filter((request) => request.status === "rejected").length,
        validatorRemovalVoteCount: validatorRequests.filter((request) => request.removalVoteProposedAt).length,
        recentNodeRequests: nodeRequests.slice(0, 8),
        recentAdminActions: logs,
        allowlist,
        allowlistCount: allowlist.length,
        currentValidators,
        currentValidatorCount: currentValidators.length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof BesuAdminRpcError) {
      return NextResponse.json({ error: `Besu 管理概览读取失败：${error.message}` }, { status: 502 });
    }

    return NextResponse.json({ error: "管理概览读取失败，请稍后重试" }, { status: 500 });
  }
}
