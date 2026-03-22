import { getAddress, verifyMessage } from "viem";
import { NextRequest, NextResponse } from "next/server";

import { buildFaucetClaimMessage } from "@/lib/faucet/message";
import { takeFaucetAuthChallenge } from "@/lib/faucet/nonce-store";
import {
  acquireFaucetClaimLock,
  checkFaucetClaimEligibility,
  formatFaucetAmount,
  getFaucetAmount,
  getFaucetClients,
  getCooldownRemainingSeconds,
  getFaucetMinBalance,
  getRequestIp,
  markFaucetClaimed,
  releaseFaucetClaimLock,
} from "@/lib/faucet/utils";
import { getRequestSite } from "@/lib/auth/request";
import { knowledgeChain } from "@/lib/chains";

export const runtime = "nodejs";

type FaucetClaimBody = {
  address?: string;
  nonce?: string;
  signature?: string;
};

export async function POST(req: NextRequest) {
  let body: FaucetClaimBody;

  try {
    body = (await req.json()) as FaucetClaimBody;
  } catch {
    return NextResponse.json(
      { error: "请求体格式无效" },
      { status: 400 }
    );
  }

  if (!body.address || !body.nonce || !body.signature) {
    return NextResponse.json(
      { error: "缺少地址、nonce 或签名" },
      { status: 400 }
    );
  }

  let address: `0x${string}`;

  try {
    address = getAddress(body.address);
  } catch {
    return NextResponse.json(
      { error: "钱包地址格式无效" },
      { status: 400 }
    );
  }

  const challenge = await takeFaucetAuthChallenge(body.nonce);

  if (!challenge) {
    return NextResponse.json(
      { error: "签名挑战已过期或已被使用" },
      { status: 401 }
    );
  }

  const { domain, origin } = getRequestSite(req);

  if (
    challenge.domain !== domain ||
    challenge.origin !== origin ||
    challenge.chainId !== knowledgeChain.id
  ) {
    return NextResponse.json(
      { error: "签名挑战与当前站点不匹配" },
      { status: 401 }
    );
  }

  const isValidSignature = await verifyMessage({
    address,
    message: buildFaucetClaimMessage(challenge, address),
    signature: body.signature as `0x${string}`,
  });

  if (!isValidSignature) {
    return NextResponse.json(
      { error: "钱包签名无效" },
      { status: 401 }
    );
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
