import { getAddress, verifyMessage } from "viem";
import { NextRequest, NextResponse } from "next/server";

import {
  parseJsonObject,
  parseRequiredString,
} from "@/lib/api-validation";
import { getRequestSite } from "@/lib/auth/request";
import { knowledgeChain } from "@/lib/chains";
import { buildFaucetClaimMessage } from "@/lib/faucet/message";
import { takeFaucetAuthChallenge } from "@/lib/faucet/nonce-store";
import {
  acquireFaucetClaimLock,
  checkFaucetClaimEligibility,
  formatFaucetAmount,
  getCooldownRemainingSeconds,
  getFaucetAmount,
  getFaucetClients,
  getFaucetMinBalance,
  getRequestIp,
  markFaucetClaimed,
  releaseFaucetClaimLock,
} from "@/lib/faucet/utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const bodyResult = await parseJsonObject(req);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const addressResult = parseRequiredString(bodyResult.value.address, "缺少钱包地址", {
    maxLength: 128,
  });
  if (!addressResult.ok) {
    return addressResult.response;
  }

  const nonceResult = parseRequiredString(bodyResult.value.nonce, "缺少 nonce", {
    maxLength: 256,
  });
  if (!nonceResult.ok) {
    return nonceResult.response;
  }

  const signatureResult = parseRequiredString(bodyResult.value.signature, "签名格式无效", {
    maxLength: 256,
    pattern: /^0x[0-9a-fA-F]+$/,
  });
  if (!signatureResult.ok) {
    return signatureResult.response;
  }

  let address: `0x${string}`;

  try {
    address = getAddress(addressResult.value);
  } catch {
    return NextResponse.json({ error: "钱包地址格式无效" }, { status: 400 });
  }

  const challenge = await takeFaucetAuthChallenge(nonceResult.value);

  if (!challenge) {
    return NextResponse.json({ error: "签名挑战已过期或已被使用" }, { status: 401 });
  }

  const { domain, origin } = getRequestSite(req);

  if (
    challenge.domain !== domain ||
    challenge.origin !== origin ||
    challenge.chainId !== knowledgeChain.id
  ) {
    return NextResponse.json({ error: "签名挑战与当前站点不匹配" }, { status: 401 });
  }

  const isValidSignature = await verifyMessage({
    address,
    message: buildFaucetClaimMessage(challenge, address),
    signature: signatureResult.value as `0x${string}`,
  });

  if (!isValidSignature) {
    return NextResponse.json({ error: "钱包签名无效" }, { status: 401 });
  }

  const ip = getRequestIp(req.headers);
  const eligibility = await checkFaucetClaimEligibility(address, ip);

  if (!eligibility.ok) {
    return NextResponse.json(
      { error: eligibility.error },
      { status: eligibility.status }
    );
  }

  const lock = await acquireFaucetClaimLock(address);

  if (!lock) {
    const lockedCooldownSeconds = await getCooldownRemainingSeconds(address, ip);

    return NextResponse.json(
      {
        error:
          lockedCooldownSeconds > 0
            ? `Faucet 冷却中，请在 ${lockedCooldownSeconds} 秒后重试。`
            : "该钱包已有 Faucet 请求正在处理中，请稍后再试。",
      },
      { status: 429 }
    );
  }

  const amount = getFaucetAmount();
  const minBalance = getFaucetMinBalance();
  const { account, publicClient, walletClient } = await getFaucetClients();

  try {
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
    console.error("Faucet transfer failed:", error);

    return NextResponse.json(
      {
        error: "Faucet 发放失败，请稍后再试。",
      },
      { status: 500 }
    );
  }
}
