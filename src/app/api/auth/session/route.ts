import { NextRequest, NextResponse } from "next/server";

import {
    clearUploadSessionCookie,
    readUploadSession,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const session = readUploadSession(req);

    if (!session) {
        return NextResponse.json(
            { authenticated: false },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    }

    // 前后端验证签名，session，配置redis

    return NextResponse.json(
        {
            authenticated: true,
            address: session.sub,
            chainId: session.chainId,
        },
        {
            headers: {
                "Cache-Control": "no-store",
            },
        }
    );
}

export async function DELETE(req: NextRequest) {
    void req;

    const response = NextResponse.json({ authenticated: false });
    clearUploadSessionCookie(response);
    return response;
}
