import { getAddress, verifyMessage } from "viem";
import { NextRequest, NextResponse } from "next/server";

import { buildFaucetClaimMessage } from "@/lib/faucet/message";
import { takeFaucetAuthChallenge } from "@/lib/faucet/nonce-store";
import {
  formatFaucetAmount,
  getCooldownRemainingSeconds,
  getFaucetAmount,
  getFaucetClients,
  getFaucetMinBalance,
  getRequestIp,
  markFaucetClaimed,
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
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!body.address || !body.nonce || !body.signature) {
    return NextResponse.json(
      { error: "Missing address, nonce, or signature" },
      { status: 400 }
    );
  }

  let address: `0x${string}`;

  try {
    address = getAddress(body.address);
  } catch {
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400 }
    );
  }

  const challenge = await takeFaucetAuthChallenge(body.nonce);

  if (!challenge) {
    return NextResponse.json(
      { error: "Challenge expired or already used" },
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
      { error: "Challenge does not match current site" },
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
      { error: "Invalid wallet signature" },
      { status: 401 }
    );
  }

  const ip = getRequestIp(req.headers);
  const cooldownRemainingSeconds = await getCooldownRemainingSeconds(address, ip);

  if (cooldownRemainingSeconds > 0) {
    return NextResponse.json(
      {
        error: `Faucet cooldown active. Try again in ${cooldownRemainingSeconds} seconds.`,
      },
      { status: 429 }
    );
  }

  const amount = getFaucetAmount();
  const minBalance = getFaucetMinBalance();
  const { account, publicClient, walletClient } = await getFaucetClients();

  const [recipientBalance, faucetBalance] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.getBalance({ address: account.address }),
  ]);

  if (recipientBalance >= minBalance) {
    return NextResponse.json(
      {
        error: `Wallet balance is already above the faucet threshold (${formatFaucetAmount(
          minBalance
        )}).`,
      },
      { status: 400 }
    );
  }

  if (faucetBalance < amount) {
    return NextResponse.json(
      {
        error: "Faucet wallet does not have enough funds.",
      },
      { status: 503 }
    );
  }

  try {
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
    console.error("Faucet transfer failed:", error);

    return NextResponse.json(
      {
        error: "Failed to send faucet funds.",
      },
      { status: 500 }
    );
  }
}
