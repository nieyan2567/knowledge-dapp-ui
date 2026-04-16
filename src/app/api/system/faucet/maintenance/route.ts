/**
 * 模块说明：系统级 Faucet 维护接口，供受信任运维方通过系统令牌触发维护任务。
 */
import { NextRequest, NextResponse } from "next/server";

import { runFaucetMaintenance } from "@/lib/faucet/utils";
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
 * 通过系统 API 触发 Faucet 维护任务。
 * @param req 携带系统鉴权信息的请求对象。
 * @returns 包含维护报告的 JSON 响应。
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
    const report = await runFaucetMaintenance();

    return NextResponse.json(
      {
        ok: report.status === "ok",
        report,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    await captureServerException("Faucet maintenance failed", {
      source: "api.system.faucet.maintenance",
      severity: "error",
      request: req,
      error,
    });

    return NextResponse.json(
      { error: "Faucet maintenance failed" },
      { status: 500 }
    );
  }
}
