import { NextRequest, NextResponse } from "next/server";

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
    const response = NextResponse.json(
      { error: "Unauthorized upload request" },
      { status: 401 }
    );
    clearUploadSessionCookie(response);
    return response;
  }

  try {
    const provider = process.env.UPLOAD_PROVIDER || "local";

    if (provider !== "local") {
      return NextResponse.json(
        { error: "UPLOAD_PROVIDER is not local" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.IPFS_API_URL || "http://127.0.0.1:5001";
    const gatewayUrl =
      process.env.IPFS_GATEWAY_URL || "http://127.0.0.1:8080/ipfs";

    const incomingFormData = await req.formData();
    const file = incomingFormData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
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
        { error: "Kubo upload failed", detail: text },
        { status: 500 }
      );
    }

    const raw = await uploadRes.text();
    let data: KuboAddResponse;

    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse Kubo response", detail: raw },
        { status: 500 }
      );
    }

    const cid = data.Hash;

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
      { error: "Local IPFS upload failed" },
      { status: 500 }
    );
  }
}
