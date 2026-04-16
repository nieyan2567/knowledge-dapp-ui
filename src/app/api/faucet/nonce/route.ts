import { getAddress } from "viem";
/**
 * 模块说明：Faucet nonce 接口，负责在领取前为指定钱包签发带上下文绑定的签名挑战。
 */
import { NextRequest, NextResponse } from "next/server";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseValue } from "@/lib/api-validation";
import { faucetNonceQuerySchema } from "@/lib/api-schemas";
import { getRequestSite } from "@/lib/auth/request";
import { getKnowledgeChain } from "@/lib/chains";
import {
  checkFaucetClaimEligibility,
  createRequestContextHashes,
  enforceFaucetRateLimit,
  getRequestIp,
  getRequestUserAgent,
  isFaucetError,
} from "@/lib/faucet/utils";
import { createFaucetAuthChallenge } from "@/lib/faucet/nonce-store";
import { captureServerException } from "@/lib/observability/server";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 为满足条件的钱包地址创建 Faucet 签名挑战。
 * @param req 包含候选钱包地址的请求对象。
 * @returns 包含挑战信息的 JSON 响应。
 */
export async function GET(req: NextRequest) {
  const knowledgeChain = getKnowledgeChain();
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
      "请求参数无效"
    );

    if (!queryResult.ok) {
      return queryResult.response;
    }

    let address: `0x${string}`;

    try {
      address = getAddress(queryResult.value.address);
    } catch {
      return NextResponse.json(
        { error: "无效的钱包地址" },
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

    await captureServerException("Failed to create faucet challenge", {
      source: "api.faucet.nonce",
      severity: "error",
      request: req,
      error,
    });
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
