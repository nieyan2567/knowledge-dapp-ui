import { NextRequest, NextResponse } from "next/server";

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
import { validateUploadFileServer } from "@/lib/upload-policy";

export const runtime = "nodejs";

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
    const provider = process.env.UPLOAD_PROVIDER || "local";

    if (provider !== "local") {
      return errorResponse("当前仅支持本地上传服务", 400);
    }

    const apiUrl = process.env.IPFS_API_URL || "http://127.0.0.1:5001";
    const gatewayUrl =
      process.env.IPFS_GATEWAY_URL || "http://127.0.0.1:8080/ipfs";

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
      console.error("Kubo upload failed:", text);
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
    console.error("Local IPFS upload failed:", error);
    return NextResponse.json({ error: "本地 IPFS 上传失败" }, { status: 500 });
  }
}
