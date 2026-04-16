/**
 * @notice 上传鉴权 nonce 存储。
 * @dev 支持 Redis 优先、内存回退的挑战生成与一次性消费逻辑。
 */
import "server-only";

import { randomBytes } from "node:crypto";

import type { UploadAuthChallenge } from "@/lib/auth/message";
import { getServerEnv } from "@/lib/env";
import { atomicGetDel, getRedis } from "@/lib/redis";

/**
 * @notice 持久化存储中的上传鉴权挑战结构。
 * @dev 在基础挑战信息上附加过期时间，便于内存回退模式清理。
 */
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

function getUploadAuthNonceTtlSeconds() {
  return getServerEnv().UPLOAD_AUTH_NONCE_TTL_SECONDS;
}

function cleanupExpiredNonces(now: number) {
  for (const [nonce, challenge] of nonceStore.entries()) {
    if (challenge.expiresAt <= now) {
      nonceStore.delete(nonce);
    }
  }
}

/**
 * @notice 创建一条新的上传鉴权挑战。
 * @param input 除 nonce 与签发时间之外的挑战字段。
 * @returns 新生成的上传鉴权挑战对象。
 */
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
  const nonceTtlSeconds = getUploadAuthNonceTtlSeconds();

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

/**
 * @notice 原子读取并消费一条上传鉴权挑战。
 * @param nonce 待消费的挑战 nonce。
 * @returns 若存在且未过期则返回挑战对象，否则返回 `null`。
 */
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
    const raw = await atomicGetDel(getNonceKey(nonce));

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
