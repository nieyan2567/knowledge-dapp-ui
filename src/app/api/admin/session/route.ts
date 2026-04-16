import { NextRequest, NextResponse } from "next/server";

/**
 * 模块说明：管理会话接口，负责判断当前钱包是否完成签名认证以及是否具备管理员权限。
 */
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { readAdminRequestContext } from "@/server/admin/auth";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 返回当前调用方的管理会话上下文。
 * @param req 用于限流和读取管理会话的请求对象。
 * @returns 描述当前地址和管理员权限状态的 JSON 响应。
 */
export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["admin:session"]);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });
  }

  const context = await readAdminRequestContext(req);

  return NextResponse.json(
    {
      authenticated: !!context.address,
      address: context.address,
      isAdmin: context.isAdmin,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
