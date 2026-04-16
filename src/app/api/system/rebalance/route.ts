/**
 * 模块说明：系统级再平衡接口，供受信任运维方通过系统令牌触发 RevenueVault 再平衡。
 */
import { NextRequest, NextResponse } from "next/server";

import { rebalanceRevenueVault } from "@/lib/faucet/utils";
import { captureServerException } from "@/lib/observability/server";
import {
  getSystemApiToken,
  isAuthorizedSystemRequest,
} from "@/lib/system-api-auth";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 通过系统 API 触发 RevenueVault 再平衡。
 * @param req 携带系统鉴权信息的请求对象。
 * @returns 包含再平衡交易哈希的 JSON 响应。
 */
export async function POST(req: NextRequest) {
  const token = getSystemApiToken();

  if (!token) {
    return NextResponse.json(
      { error: "System API token is not configured" },
      { status: 503 }
    );
  }

  if (!isAuthorizedSystemRequest(req, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const txHash = await rebalanceRevenueVault();

    if (!txHash) {
      return NextResponse.json(
        { error: "RevenueVault is not available" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        txHash,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    await captureServerException("System rebalance failed", {
      source: "api.system.rebalance",
      severity: "error",
      request: req,
      error,
    });

    return NextResponse.json(
      { error: "System rebalance failed" },
      { status: 500 }
    );
  }
}
