import { NextRequest, NextResponse } from "next/server";

/**
 * 模块说明：孤儿文件即时清理接口，负责在前端发布失败后回收刚刚上传到本地 IPFS 的未登记文件。
 */
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import {
  uploadCleanupBodySchema,
} from "@/lib/api-schemas";
import {
  errorResponse,
  parseJsonBody,
} from "@/lib/api-validation";
import {
  clearUploadSessionCookie,
  readUploadSession,
} from "@/lib/auth/session";
import { cleanupIpfsUploadRecordById } from "@/lib/ipfs-upload-lifecycle";
import { captureServerException } from "@/lib/observability/server";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 对单条上传记录执行即时孤儿清理。
 * @param req 携带上传记录 ID 的 JSON 请求。
 * @returns 返回清理结果的 JSON 响应。
 */
export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, [
    "ipfs:cleanup-orphan",
  ]);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: rateLimit.error },
      { status: rateLimit.status }
    );
  }

  const session = await readUploadSession(req);

  if (!session) {
    const response = errorResponse("未授权的清理请求", 401);
    clearUploadSessionCookie(response);
    return response;
  }

  const body = await parseJsonBody(
    req,
    uploadCleanupBodySchema,
    "清理请求格式无效"
  );

  if (!body.ok) {
    return body.response;
  }

  try {
    const report = await cleanupIpfsUploadRecordById({
      recordId: body.value.uploadId,
      reason: body.value.reason ?? "publish_flow_failed",
      expectedAddress: session.sub,
    });

    if (report.outcome === "forbidden") {
      return errorResponse("当前会话无权清理该上传记录", 403);
    }

    if (report.outcome === "missing") {
      return errorResponse("上传记录不存在", 404);
    }

    return NextResponse.json({
      ok: report.outcome !== "failed",
      report,
    });
  } catch (error) {
    await captureServerException("Failed to clean orphan upload record", {
      source: "api.ipfs.cleanup_orphan",
      severity: "error",
      request: req,
      error,
      context: {
        sessionSub: session.sub,
      },
    });

    return errorResponse("孤儿文件清理失败", 500);
  }
}
