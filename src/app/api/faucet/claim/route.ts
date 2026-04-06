import { getAddress, verifyMessage } from "viem";
import { NextRequest, NextResponse } from "next/server";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { signedRequestBodySchema } from "@/lib/api-schemas";
import { getRequestSite } from "@/lib/auth/request";
import { getKnowledgeChain } from "@/lib/chains";
import { buildFaucetClaimMessage } from "@/lib/faucet/message";
import { takeFaucetAuthChallenge } from "@/lib/faucet/nonce-store";
import {
  acquireFaucetClaimLock,
  checkFaucetClaimEligibility,
  createFaucetClaimAuthorization,
  createRequestContextHashes,
  enforceFaucetRateLimit,
  FaucetInfraError,
  formatFaucetAmount,
  getCooldownRemainingSeconds,
  getRequestIp,
  getRequestUserAgent,
  isFaucetError,
  markFaucetClaimed,
  rebalanceRevenueVault,
  releaseFaucetClaimLock,
  runFaucetMaintenance,
  submitFaucetClaim,
} from "@/lib/faucet/utils";
import { captureServerException } from "@/lib/observability/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const knowledgeChain = getKnowledgeChain();
  const rateLimit = await enforceApiRateLimits(req.headers, ["faucet:claim"]);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });
  }

  const bodyResult = await parseJsonBody(req, signedRequestBodySchema);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const body = bodyResult.value;

  let address: `0x${string}`;

  try {
    address = getAddress(body.address);
  } catch {
    return NextResponse.json({ error: "无效的钱包地址" }, { status: 400 });
  }

  try {
    const challenge = await takeFaucetAuthChallenge(body.nonce);

    if (!challenge) {
      return NextResponse.json(
        { error: "签名挑战不存在或已过期，请重新发起请求" },
        { status: 401 }
      );
    }

    const { domain, origin } = getRequestSite(req);

    if (
      challenge.domain !== domain ||
      challenge.origin !== origin ||
      challenge.chainId !== knowledgeChain.id ||
      challenge.address.toLowerCase() !== address.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "签名挑战与当前请求不匹配" },
        { status: 401 }
      );
    }

    const ip = getRequestIp(req.headers);
    const contextHashes = createRequestContextHashes({
      address,
      ip,
      userAgent: getRequestUserAgent(req.headers),
    });

    if (
      challenge.ipHash !== contextHashes.ipHash ||
      challenge.userAgentHash !== contextHashes.userAgentHash
    ) {
      return NextResponse.json(
        { error: "签名挑战与当前设备或网络环境不匹配" },
        { status: 401 }
      );
    }

    const isValidSignature = await verifyMessage({
      address,
      message: buildFaucetClaimMessage(challenge, address),
      signature: body.signature as `0x${string}`,
    });

    if (!isValidSignature) {
      return NextResponse.json({ error: "钱包签名无效" }, { status: 401 });
    }

    await enforceFaucetRateLimit("claim", address, ip);

    const maintenance = await runFaucetMaintenance();
    if (
      BigInt(maintenance.relayer.balance) < BigInt(maintenance.relayer.alertMinBalance)
    ) {
      throw new FaucetInfraError("Faucet relayer 余额不足，请稍后重试。");
    }

    try {
      await rebalanceRevenueVault();
    } catch (error) {
      await captureServerException("RevenueVault rebalance failed before faucet claim", {
        source: "api.faucet.claim.rebalance",
        severity: "warn",
        request: req,
        error,
        alert: false,
        context: {
          address,
        },
      });
    }

    const eligibility = await checkFaucetClaimEligibility(address, ip);
    if (!eligibility.ok) {
      return NextResponse.json(
        { error: eligibility.error },
        { status: eligibility.status }
      );
    }

    const lock = await acquireFaucetClaimLock(address, ip);
    if (!lock) {
      const lockedCooldownSeconds = await getCooldownRemainingSeconds(address, ip);

      return NextResponse.json(
        {
          error:
            lockedCooldownSeconds > 0
              ? `Faucet 冷却中，请在 ${lockedCooldownSeconds} 秒后重试`
              : "该钱包或当前网络已有 Faucet 请求正在处理中，请稍后重试",
        },
        { status: 429 }
      );
    }

    try {
      const authorization = await createFaucetClaimAuthorization(address);
      const txHash = await submitFaucetClaim({
        recipient: address,
        amount: authorization.amount,
        deadline: authorization.deadline,
        nonce: authorization.nonce,
        signature: authorization.signature,
      });

      await markFaucetClaimed({
        address,
        amount: authorization.amount.toString(),
        txHash,
        claimedAt: new Date().toISOString(),
        ip,
      });

      return NextResponse.json(
        {
          ok: true,
          txHash,
          amount: authorization.amount.toString(),
          displayAmount: formatFaucetAmount(authorization.amount),
          address,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    } catch (error) {
      await releaseFaucetClaimLock(lock);
      throw error;
    }
  } catch (error) {
    if (isFaucetError(error)) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: error.status }
      );
    }

    await captureServerException("Faucet relay claim failed", {
      source: "api.faucet.claim",
      severity: "error",
      request: req,
      error,
    });

    return NextResponse.json(
      {
        error: "Faucet 发放失败，请稍后重试",
      },
      { status: 500 }
    );
  }
}
