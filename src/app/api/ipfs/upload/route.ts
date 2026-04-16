import { NextRequest, NextResponse } from "next/server";

/**
 * 模块说明：IPFS 上传接口，负责校验上传会话、验证文件并把文件转发到本地 Kubo 节点。
 */
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { errorResponse, parseValue } from "@/lib/api-validation";
import {
  kuboAddResponseSchema,
  uploadFileSchema,
} from "@/lib/api-schemas";
import {
  clearUploadSessionCookie,
  readUploadSession,
} from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import {
  captureServerEvent,
  captureServerException,
} from "@/lib/observability/server";
import { validateUploadFileServer } from "@/lib/upload-policy";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 把通过校验的文件上传到当前配置的本地 IPFS 服务。
 * @param req 携带 multipart 文件数据和上传会话的请求对象。
 * @returns 包含 CID、网关地址等信息的 JSON 响应。
 */
export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["ipfs:upload"]);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: rateLimit.error },
      { status: rateLimit.status }
    );
  }

  const session = await readUploadSession(req);

  if (!session) {
    const response = errorResponse("未授权的上传请求", 401);
    clearUploadSessionCookie(response);
    return response;
  }

  try {
    const env = getServerEnv();
    const provider = env.UPLOAD_PROVIDER;

    if (provider !== "local") {
      return errorResponse("当前仅支持本地上传服务", 400);
    }

    const apiUrl = env.IPFS_API_URL;
    const gatewayUrl = env.IPFS_GATEWAY_URL;

    const incomingFormData = await req.formData();
    const fileResult = parseValue(
      incomingFormData.get("file"),
      uploadFileSchema,
      "未检测到上传文件"
    );

    if (!fileResult.ok) {
      return fileResult.response;
    }

    const file = fileResult.value;
    const uploadValidation = await validateUploadFileServer(file);

    if (!uploadValidation.ok) {
      return errorResponse(uploadValidation.error, uploadValidation.status);
    }

    const kuboFormData = new FormData();
    kuboFormData.append("file", file, file.name);

    const uploadRes = await fetch(`${apiUrl}/api/v0/add?pin=true`, {
      method: "POST",
      body: kuboFormData,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      await captureServerEvent({
        message: "Kubo upload returned a non-success response",
        source: "api.ipfs.upload",
        severity: "error",
        request: req,
        context: {
          provider,
          apiUrl,
          detail: text,
          uploadedBy: session.sub,
        },
      });
      return NextResponse.json(
        { error: "IPFS 上传失败", detail: text },
        { status: 500 }
      );
    }

    const raw = await uploadRes.text();
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "IPFS 返回结果解析失败", detail: raw },
        { status: 500 }
      );
    }

    const kuboResult = parseValue(
      parsed,
      kuboAddResponseSchema,
      "IPFS 未返回有效 CID"
    );

    if (!kuboResult.ok) {
      return NextResponse.json(
        { error: "IPFS 未返回有效 CID", detail: raw },
        { status: 500 }
      );
    }

    const { Hash: cid } = kuboResult.value;

    return NextResponse.json({
      provider: "local",
      cid,
      name: file.name,
      size: file.size,
      url: `${gatewayUrl}/${cid}`,
      uploadedBy: session.sub,
      sessionVersion: session.version,
    });
  } catch (error) {
    await captureServerException("Local IPFS upload failed", {
      source: "api.ipfs.upload",
      severity: "error",
      request: req,
      error,
      context: {
        sessionSub: session.sub,
      },
    });
    return NextResponse.json({ error: "本地 IPFS 上传失败" }, { status: 500 });
  }
}
