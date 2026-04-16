/**
 * @file Faucet 挑战随机数存储模块。
 * @description 管理 Faucet 登录挑战的生成、暂存和一次性消费，支持 Redis 与内存双实现。
 */
import "server-only";

import { randomBytes } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import { atomicGetDel, getRedis } from "@/lib/redis";
import type { FaucetAuthChallenge } from "@/lib/faucet/message";

/**
 * @notice 带过期时间的 Faucet 挑战存储结构。
 */
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

/**
 * @notice 创建新的 Faucet 鉴权挑战并写入一次性存储。
 * @param input 除随机数和签发时间外的挑战字段。
 * @returns 可发给客户端签名的钱包挑战对象。
 */
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
    // Redis 可跨实例共享挑战状态；若不可用，则退回单机内存存储保证本地开发可运行。
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

/**
 * @notice 读取并消费指定的 Faucet 鉴权挑战。
 * @param nonce 待消费的挑战随机数。
 * @returns 挑战存在时返回原始挑战；不存在、过期或解析失败时返回 `null`。
 */
export async function takeFaucetAuthChallenge(
  nonce: string
): Promise<FaucetAuthChallenge | null> {
  const now = Date.now();
  cleanupExpiredNonces(now);

  const redis = await getRedis();

  if (redis) {
    const raw = await atomicGetDel(getNonceKey(nonce));

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
