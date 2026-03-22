import { NextRequest, NextResponse } from "next/server";

import { errorResponse, parseFile } from "@/lib/api-validation";
import {
  clearUploadSessionCookie,
  readUploadSession,
} from "@/lib/auth/session";

type KuboAddResponse = {
  Hash: string;
};

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = readUploadSession(req);

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
    const fileResult = parseFile(incomingFormData.get("file"));

    if (!fileResult.ok) {
      return fileResult.response;
    }

    const file = fileResult.value;
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
    let data: KuboAddResponse;

    try {
      data = JSON.parse(raw) as KuboAddResponse;
    } catch {
      return NextResponse.json(
        { error: "IPFS 返回结果解析失败", detail: raw },
        { status: 500 }
      );
    }

    const cid = data.Hash;

    if (typeof cid !== "string" || !cid.trim()) {
      return NextResponse.json(
        { error: "IPFS 未返回有效 CID", detail: raw },
        { status: 500 }
      );
    }

    return NextResponse.json({
      provider: "local",
      cid,
      name: file.name,
      size: file.size,
      url: `${gatewayUrl}/${cid}`,
      uploadedBy: session.sub,
    });
  } catch (error) {
    console.error("Local IPFS upload failed:", error);
    return NextResponse.json(
      { error: "本地 IPFS 上传失败" },
      { status: 500 }
    );
  }
}
