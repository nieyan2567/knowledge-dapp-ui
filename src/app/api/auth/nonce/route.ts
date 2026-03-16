import { NextRequest, NextResponse } from "next/server";

import { createUploadAuthChallenge } from "@/lib/auth/nonce-store";
import { getRequestSite } from "@/lib/auth/request";
import { knowledgeChain } from "@/lib/chains";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const { domain, origin } = getRequestSite(req);

    const challenge = await createUploadAuthChallenge({
        domain,
        origin,
        chainId: knowledgeChain.id,
    });

    return NextResponse.json(challenge, {
        headers: {
            "Cache-Control": "no-store",
        },
    });
}
