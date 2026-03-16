import "server-only";

import { randomBytes } from "node:crypto";

import type { UploadAuthChallenge } from "@/lib/auth/message";
import { getRedis } from "@/lib/redis";

type StoredUploadAuthChallenge = UploadAuthChallenge & {
  expiresAt: number;
};

declare global {
  // Replace this with Redis or a database-backed store in multi-instance production.
  var __knowledgeUploadNonceStore:
    | Map<string, StoredUploadAuthChallenge>
    | undefined;
}

const nonceStore =
  globalThis.__knowledgeUploadNonceStore ??
  new Map<string, StoredUploadAuthChallenge>();

if (!globalThis.__knowledgeUploadNonceStore) {
  globalThis.__knowledgeUploadNonceStore = nonceStore;
}

const nonceTtlSeconds = Number(
  process.env.UPLOAD_AUTH_NONCE_TTL_SECONDS || "300"
);

function cleanupExpiredNonces(now: number) {
  for (const [nonce, challenge] of nonceStore.entries()) {
    if (challenge.expiresAt <= now) {
      nonceStore.delete(nonce);
    }
  }
}

export function createUploadAuthChallenge(
  input: Omit<UploadAuthChallenge, "nonce" | "issuedAt">
): Promise<UploadAuthChallenge> {
  return createUploadAuthChallengeInternal(input);
}

async function createUploadAuthChallengeInternal(
  input: Omit<UploadAuthChallenge, "nonce" | "issuedAt">
): Promise<UploadAuthChallenge> {
  const now = Date.now();
  cleanupExpiredNonces(now);

  const challenge: StoredUploadAuthChallenge = {
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
  };
}

export function takeUploadAuthChallenge(
  nonce: string
): Promise<UploadAuthChallenge | null> {
  return takeUploadAuthChallengeInternal(nonce);
}

function getNonceKey(nonce: string) {
  return `upload_nonce:${nonce}`;
}

async function takeUploadAuthChallengeInternal(
  nonce: string
): Promise<UploadAuthChallenge | null> {
  const now = Date.now();
  cleanupExpiredNonces(now);

  const redis = await getRedis();

  if (redis) {
    const raw = await redis.getDel(getNonceKey(nonce));

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as UploadAuthChallenge;
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
  };
}
