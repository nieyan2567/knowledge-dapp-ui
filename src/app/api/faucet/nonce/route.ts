import { getAddress } from "viem";
import { NextRequest, NextResponse } from "next/server";

import { parseValue } from "@/lib/api-validation";
import { faucetNonceQuerySchema } from "@/lib/api-schemas";
import { getRequestSite } from "@/lib/auth/request";
import { knowledgeChain } from "@/lib/chains";
import {
  checkFaucetClaimEligibility,
  getRequestIp,
} from "@/lib/faucet/utils";
import { createFaucetAuthChallenge } from "@/lib/faucet/nonce-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const queryResult = parseValue(
    {
      address: req.nextUrl.searchParams.get("address") ?? undefined,
    },
    faucetNonceQuerySchema,
    "请求参数格式无效"
  );

  if (!queryResult.ok) {
    return queryResult.response;
  }

  const rawAddress = queryResult.value.address;

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
