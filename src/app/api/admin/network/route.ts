import { NextRequest, NextResponse } from "next/server";

/**
 * 模块说明：管理网络状态接口，负责读取当前 Besu 联盟链节点 allowlist。
 */
import { getNodesAllowlist } from "@/lib/besu-admin/permissioning";
import { BesuAdminRpcError } from "@/lib/besu-admin/client";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { requireAdminRequest } from "@/server/admin/auth";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 返回当前 Besu 网络 allowlist 状态。
 * @param req 用于鉴权和限流的请求对象。
 * @returns 包含 allowlist 节点列表的 JSON 响应。
 */
export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:network"]);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });
  }

  const authResult = await requireAdminRequest(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const allowlist = await getNodesAllowlist();

    return NextResponse.json(
      {
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
        { error: `Besu 网络状态读取失败: ${error.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "网络状态读取失败，请稍后重试" },
      { status: 500 }
    );
  }
}
