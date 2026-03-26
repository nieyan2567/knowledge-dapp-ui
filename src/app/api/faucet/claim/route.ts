import { getAddress, verifyMessage } from "viem";
import { NextRequest, NextResponse } from "next/server";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { signedRequestBodySchema } from "@/lib/api-schemas";
import { getRequestSite } from "@/lib/auth/request";
import { knowledgeChain } from "@/lib/chains";
import { buildFaucetClaimMessage } from "@/lib/faucet/message";
import { takeFaucetAuthChallenge } from "@/lib/faucet/nonce-store";
import {
  acquireFaucetClaimLock,
  checkFaucetClaimEligibility,
  createRequestContextHashes,
  enforceFaucetRateLimit,
  formatFaucetAmount,
  getCooldownRemainingSeconds,
  getFaucetAmount,
  getFaucetClients,
  getFaucetMinBalance,
  getRequestIp,
  getRequestUserAgent,
  isFaucetError,
  markFaucetClaimed,
  rebalanceRevenueVault,
  releaseFaucetClaimLock,
} from "@/lib/faucet/utils";
import { captureServerException } from "@/lib/observability/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: "钱包地址格式无效" }, { status: 400 });
  }

  try {
    const challenge = await takeFaucetAuthChallenge(body.nonce);

    if (!challenge) {
      return NextResponse.json({ error: "签名挑战已过期或已被使用" }, { status: 401 });
    }

    const { domain, origin } = getRequestSite(req);

    if (
      challenge.domain !== domain ||
      challenge.origin !== origin ||
      challenge.chainId !== knowledgeChain.id ||
      challenge.address.toLowerCase() !== address.toLowerCase()
    ) {
      return NextResponse.json({ error: "签名挑战与当前请求不匹配" }, { status: 401 });
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
      return NextResponse.json({ error: "签名挑战与当前设备环境不匹配" }, { status: 401 });
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

    await rebalanceRevenueVault();

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
              ? `Faucet 冷却中，请在 ${lockedCooldownSeconds} 秒后重试。`
              : "该钱包或当前网络已有 Faucet 请求正在处理中，请稍后再试。",
        },
        { status: 429 }
      );
    }

    try {
      const amount = getFaucetAmount();
      const minBalance = getFaucetMinBalance();
      const { account, publicClient, walletClient } = await getFaucetClients();
      const [recipientBalance, faucetBalance] = await Promise.all([
        publicClient.getBalance({ address }),
        publicClient.getBalance({ address: account.address }),
      ]);

      if (recipientBalance >= minBalance) {
        await releaseFaucetClaimLock(lock);

        return NextResponse.json(
          {
            error: `钱包余额已达到 Faucet 门槛（${formatFaucetAmount(
              minBalance
            )}），暂时无法领取。`,
          },
          { status: 400 }
        );
      }

      if (faucetBalance < amount) {
        await releaseFaucetClaimLock(lock);

        return NextResponse.json(
          {
            error: "Faucet 钱包余额不足，请稍后再试。",
          },
          { status: 503 }
        );
      }

      const txHash = await walletClient.sendTransaction({
        account,
        to: address,
        value: amount,
        chain: knowledgeChain,
      });

      await markFaucetClaimed({
        address,
        amount: amount.toString(),
        txHash,
        claimedAt: new Date().toISOString(),
        ip,
      });

      return NextResponse.json(
        {
          ok: true,
          txHash,
          amount: amount.toString(),
          displayAmount: formatFaucetAmount(amount),
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

    await captureServerException("Faucet transfer failed", {
      source: "api.faucet.claim",
      severity: "error",
      request: req,
      error,
    });

    return NextResponse.json(
      {
        error: "Faucet 发放失败，请稍后再试。",
      },
      { status: 500 }
    );
  }
}
