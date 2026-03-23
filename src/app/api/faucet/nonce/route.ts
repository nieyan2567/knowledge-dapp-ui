import { getAddress } from "viem";
import { NextRequest, NextResponse } from "next/server";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseValue } from "@/lib/api-validation";
import { faucetNonceQuerySchema } from "@/lib/api-schemas";
import { getRequestSite } from "@/lib/auth/request";
import { knowledgeChain } from "@/lib/chains";
import {
  checkFaucetClaimEligibility,
  createRequestContextHashes,
  enforceFaucetRateLimit,
  getRequestUserAgent,
  isFaucetError,
  getRequestIp,
} from "@/lib/faucet/utils";
import { createFaucetAuthChallenge } from "@/lib/faucet/nonce-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["faucet:nonce"]);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: rateLimit.error },
      {
        status: rateLimit.status,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    const queryResult = parseValue(
      {
        address: req.nextUrl.searchParams.get("address"),
      },
      faucetNonceQuerySchema,
      "请求参数格式无效"
    );

    if (!queryResult.ok) {
      return queryResult.response;
    }

    let address: `0x${string}`;

    try {
      address = getAddress(queryResult.value.address);
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

    const ip = getRequestIp(req.headers);
    await enforceFaucetRateLimit("nonce", address, ip);

    const eligibility = await checkFaucetClaimEligibility(address, ip);

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

    const { domain, origin } = getRequestSite(req);
    const challenge = await createFaucetAuthChallenge({
      domain,
      origin,
      chainId: knowledgeChain.id,
      ...createRequestContextHashes({
        address,
        ip,
        userAgent: getRequestUserAgent(req.headers),
      }),
    });

    return NextResponse.json(challenge, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isFaucetError(error)) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    console.error("Failed to create faucet challenge:", error);
    return NextResponse.json(
      { error: "Faucet 服务暂时不可用，请稍后再试。" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
