import { getAddress } from "viem";
import { NextRequest, NextResponse } from "next/server";

import { createFaucetAuthChallenge } from "@/lib/faucet/nonce-store";
import { getRequestSite } from "@/lib/auth/request";
import { knowledgeChain } from "@/lib/chains";
import {
  checkFaucetClaimEligibility,
  getRequestIp,
} from "@/lib/faucet/utils";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rawAddress = req.nextUrl.searchParams.get("address");

  if (rawAddress) {
    let address: `0x${string}`;

    try {
      address = getAddress(rawAddress);
    } catch {
      return NextResponse.json(
        { error: "钱包地址格式无效" },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const eligibility = await checkFaucetClaimEligibility(
      address,
      getRequestIp(req.headers)
    );

    if (!eligibility.ok) {
      return NextResponse.json(
        { error: eligibility.error },
        {
          status: eligibility.status,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }
  }

  const { domain, origin } = getRequestSite(req);

  const challenge = await createFaucetAuthChallenge({
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
