import { NextRequest, NextResponse } from "next/server";

/**
 * @file 上传记录登记回写接口。
 * @description 在链上内容注册或版本更新确认后，验证交易回执并把上传记录绑定到具体 content/version。
 */
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import {
  clearUploadSessionCookie,
  readUploadSession,
} from "@/lib/auth/session";
import { uploadRegisterCompleteBodySchema } from "@/lib/api-schemas";
import { errorResponse, parseJsonBody } from "@/lib/api-validation";
import { readVerifiedContentMutationFromTx } from "@/lib/content-chain-verification";
import { captureServerException } from "@/lib/observability/server";
import {
  getIpfsUploadRecordById,
  markIpfsUploadRegistered,
} from "@/lib/upload-record-store";

export const runtime = "nodejs";

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

    const verified = await readVerifiedContentMutationFromTx({
      txHash: body.value.txHash as `0x${string}`,
      kind: body.value.kind,
    });

    const updated = await markIpfsUploadRegistered(record.id, {
      txHash: body.value.txHash,
      contentId: verified.contentId,
      versionNumber: verified.versionNumber,
    });

    if (!updated) {
      return errorResponse("上传记录回写失败", 500);
    }

    return NextResponse.json({
      ok: true,
      uploadId: updated.id,
      cid: updated.cid,
      status: updated.status,
      txHash: updated.registerTxHash,
      contentId: updated.contentId?.toString() ?? null,
      versionNumber: updated.versionNumber?.toString() ?? null,
    });
  } catch (error) {
    await captureServerException("Failed to bind upload record to content", {
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
