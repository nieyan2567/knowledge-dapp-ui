import "server-only";

import { randomBytes } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import type { FaucetAuthChallenge } from "@/lib/faucet/message";

type StoredFaucetChallenge = FaucetAuthChallenge & {
  expiresAt: number;
};

declare global {
  var __knowledgeFaucetNonceStore:
    | Map<string, StoredFaucetChallenge>
    | undefined;
}

const nonceStore =
  globalThis.__knowledgeFaucetNonceStore ??
  new Map<string, StoredFaucetChallenge>();

if (!globalThis.__knowledgeFaucetNonceStore) {
  globalThis.__knowledgeFaucetNonceStore = nonceStore;
}

function getFaucetNonceTtlSeconds() {
  return getServerEnv().FAUCET_NONCE_TTL_SECONDS;
}

function getNonceKey(nonce: string) {
  return `faucet_nonce:${nonce}`;
}

function cleanupExpiredNonces(now: number) {
  for (const [nonce, challenge] of nonceStore.entries()) {
    if (challenge.expiresAt <= now) {
      nonceStore.delete(nonce);
    }
  }
}

export async function createFaucetAuthChallenge(
  input: Omit<FaucetAuthChallenge, "nonce" | "issuedAt">
): Promise<FaucetAuthChallenge> {
  const now = Date.now();
  cleanupExpiredNonces(now);
  const nonceTtlSeconds = getFaucetNonceTtlSeconds();

  const challenge: StoredFaucetChallenge = {
    ...input,
    nonce: randomBytes(16).toString("hex"),
    issuedAt: new Date(now).toISOString(),
    expiresAt: now + nonceTtlSeconds * 1000,
  };

  const redis = await getRedis();

  if (redis) {
    await redis.set(
      getNonceKey(challenge.nonce),
        JSON.stringify({
          nonce: challenge.nonce,
          issuedAt: challenge.issuedAt,
          domain: challenge.domain,
          origin: challenge.origin,
          chainId: challenge.chainId,
          address: challenge.address,
          ipHash: challenge.ipHash,
          userAgentHash: challenge.userAgentHash,
        }),
      {
        EX: nonceTtlSeconds,
      }
    );
  } else {
    nonceStore.set(challenge.nonce, challenge);
  }

  return {
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    domain: challenge.domain,
    origin: challenge.origin,
    chainId: challenge.chainId,
    address: challenge.address,
    ipHash: challenge.ipHash,
    userAgentHash: challenge.userAgentHash,
  };
}

export async function takeFaucetAuthChallenge(
  nonce: string
): Promise<FaucetAuthChallenge | null> {
  const now = Date.now();
  cleanupExpiredNonces(now);

  const redis = await getRedis();

  if (redis) {
    const raw = await redis.getDel(getNonceKey(nonce));

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as FaucetAuthChallenge;
    } catch {
      return null;
    }
  }

  const challenge = nonceStore.get(nonce);

  if (!challenge) {
    return null;
  }

  nonceStore.delete(nonce);

  return {
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    domain: challenge.domain,
    origin: challenge.origin,
    chainId: challenge.chainId,
    address: challenge.address,
    ipHash: challenge.ipHash,
    userAgentHash: challenge.userAgentHash,
  };
}
