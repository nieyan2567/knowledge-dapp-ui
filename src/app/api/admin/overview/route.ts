import { NextRequest, NextResponse } from "next/server";

import { getNodesAllowlist } from "@/lib/besu-admin/permissioning";
import { BesuAdminRpcError } from "@/lib/besu-admin/client";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { listNodeRequests, listRecentAdminActionLogs } from "@/server/admin/store";
import { requireAdminRequest } from "@/server/admin/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:overview"]);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });
  }

  const authResult = await requireAdminRequest(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const [requests, logs, allowlist] = await Promise.all([
      listNodeRequests(),
      listRecentAdminActionLogs(8),
      getNodesAllowlist(),
    ]);

    const pendingNodeRequestCount = requests.filter(
      (request) => request.status === "pending"
    ).length;

    return NextResponse.json(
      {
        pendingNodeRequestCount,
        recentNodeRequests: requests.slice(0, 8),
        recentAdminActions: logs,
        allowlist,
        allowlistCount: allowlist.length,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (error instanceof BesuAdminRpcError) {
      return NextResponse.json(
        { error: `Besu 管理概览读取失败：${error.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "管理概览读取失败，请稍后重试" },
      { status: 500 }
    );
  }
}
