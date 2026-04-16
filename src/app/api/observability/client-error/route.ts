import { NextRequest, NextResponse } from "next/server";
/**
 * 模块说明：前端错误上报接口，负责接收浏览器侧序列化后的异常并写入服务端观测链路。
 */
import { z } from "zod";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import type { SerializedError } from "@/lib/observability/shared";
import { captureClientErrorReport } from "@/lib/observability/server";

const serializedErrorSchema: z.ZodType<SerializedError> = z.lazy(() =>
  z.object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    code: z.string().optional(),
    cause: serializedErrorSchema.optional(),
  })
);

const clientErrorReportSchema = z.object({
  message: z.string().trim().min(1),
  source: z.string().trim().min(1),
  severity: z.enum(["debug", "info", "warn", "error", "fatal"]).optional(),
  handled: z.boolean().optional(),
  fingerprint: z.string().trim().min(1).optional(),
  tags: z.record(z.string(), z.string()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  error: serializedErrorSchema.optional(),
  pathname: z.string().trim().optional(),
  url: z.string().trim().optional(),
  userAgent: z.string().trim().optional(),
  occurredAt: z.string().trim().optional(),
});

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 接收并记录前端错误上报。
 * @param req 携带序列化错误信息的请求对象。
 * @returns 成功接收后返回 `202 Accepted` 响应。
 */
export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["client:error"]);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: rateLimit.error },
      { status: rateLimit.status }
    );
  }

  const bodyResult = await parseJsonBody(
    req,
    clientErrorReportSchema,
    "Invalid client error report payload"
  );

  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const eventId = await captureClientErrorReport(bodyResult.value, {
    request: req,
  });

  return NextResponse.json(
    { accepted: true, eventId },
    {
      status: 202,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
