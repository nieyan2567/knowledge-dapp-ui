import { NextRequest, NextResponse } from "next/server";

/**
 * 模块说明：上传记录回写接口，负责在内容成功上链后把对应上传记录标记为已登记。
 */
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import {
  clearUploadSessionCookie,
  readUploadSession,
} from "@/lib/auth/session";
import {
  uploadRegisterCompleteBodySchema,
} from "@/lib/api-schemas";
import {
  errorResponse,
  parseJsonBody,
} from "@/lib/api-validation";
import {
  captureServerException,
} from "@/lib/observability/server";
import {
  getIpfsUploadRecordById,
  markIpfsUploadRegistered,
} from "@/lib/upload-record-store";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 把已确认的链上登记结果回写到上传记录中。
 * @param req 携带上传记录 ID 与交易哈希的 JSON 请求。
 * @returns 包含回写结果的 JSON 响应。
 */
export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, [
    "ipfs:register-complete",
  ]);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: rateLimit.error },
      { status: rateLimit.status }
    );
  }

  const session = await readUploadSession(req);

  if (!session) {
    const response = errorResponse("未授权的回写请求", 401);
    clearUploadSessionCookie(response);
    return response;
  }

  const body = await parseJsonBody(
    req,
    uploadRegisterCompleteBodySchema,
    "回写请求格式无效"
  );

  if (!body.ok) {
    return body.response;
  }

  try {
    const record = await getIpfsUploadRecordById(body.value.uploadId);

    if (!record) {
      return errorResponse("上传记录不存在", 404);
    }

    if (record.address.toLowerCase() !== session.sub.toLowerCase()) {
      return errorResponse("当前会话无权回写该上传记录", 403);
    }

    const updated = await markIpfsUploadRegistered(
      record.id,
      body.value.txHash
    );

    if (!updated) {
      return errorResponse("上传记录回写失败", 500);
    }

    return NextResponse.json({
      ok: true,
      uploadId: updated.id,
      cid: updated.cid,
      status: updated.status,
      txHash: updated.registerTxHash,
    });
  } catch (error) {
    await captureServerException("Failed to mark upload record as registered", {
      source: "api.ipfs.register_complete",
      severity: "error",
      request: req,
      error,
      context: {
        sessionSub: session.sub,
      },
    });

    return errorResponse("上传记录回写失败", 500);
  }
}
