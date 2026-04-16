/**
 * @notice Faucet Redis 状态存储工具。
 * @dev 负责冷却查询、并发锁、领取记录和限流计数。
 */
import "server-only";

import { getFaucetRateLimitMessage } from "@/lib/faucet/copy";
import {
  getFaucetCooldownSeconds,
  getFaucetLockTtlSeconds,
  getRateLimitMax,
  getRateLimitWindowSeconds,
} from "@/lib/faucet/config";
import {
  readFaucetVaultConfig,
  readRecipientLastClaimAt,
} from "@/lib/faucet/client";
import {
  getAddressClaimKey,
  getAddressLockKey,
  getIpClaimKey,
  getIpLockKey,
  normalizeIp,
} from "@/lib/faucet/request-context";
import {
  FaucetInfraError,
  FaucetRateLimitError,
  type FaucetClaimLock,
  type FaucetClaimRecord,
} from "@/lib/faucet/types";
import { getRedis } from "@/lib/redis";

/**
 * @notice 读取并规范化 Redis 键的 TTL。
 * @param redis 已连接的 Redis 客户端。
 * @param key 目标键名。
 * @returns 非负 TTL 秒数。
 */
async function getPositiveTtl(
  redis: Awaited<ReturnType<typeof getRedis>>,
  key: string
) {
  if (!redis) {
    throw new FaucetInfraError();
  }

  const ttl = await redis.ttl(key);
  return Math.max(ttl, 0);
}

async function getRequiredFaucetRedis() {
  const redis = await getRedis();

  if (!redis) {
    throw new FaucetInfraError();
  }

  return redis;
}

/**
 * @notice 获取地址或 IP 维度的剩余冷却时间。
 * @param address 当前钱包地址。
 * @param ip 当前请求来源 IP。
 * @returns 剩余冷却秒数。
 */
export async function getCooldownRemainingSeconds(
  address: `0x${string}`,
  ip: string | null
) {
  const redis = await getRequiredFaucetRedis();

  const normalizedIp = normalizeIp(ip);
  const ttlValues = await Promise.all([
    getPositiveTtl(redis, getAddressClaimKey(address)),
    getPositiveTtl(redis, getAddressLockKey(address)),
    normalizedIp
      ? getPositiveTtl(redis, getIpClaimKey(normalizedIp))
      : Promise.resolve(0),
    normalizedIp
      ? getPositiveTtl(redis, getIpLockKey(normalizedIp))
      : Promise.resolve(0),
  ]);

  const offchainTtl = Math.max(...ttlValues, 0);

  /**
   * @notice 冷却时间同时考虑链下 Redis 记录和链上最近领取时间。
   * @dev 两者取最大值，避免链下状态丢失导致重复领取。
   */
  try {
    const [lastClaimAt, claimCooldown] = await Promise.all([
      readRecipientLastClaimAt(address),
      readFaucetVaultConfig().then((config) => config.claimCooldown),
    ]);

    const onchainReadyAt = Number(lastClaimAt + claimCooldown);
    const onchainTtl = Math.max(0, onchainReadyAt - Math.floor(Date.now() / 1000));
    return Math.max(offchainTtl, onchainTtl);
  } catch {
    return offchainTtl;
  }
}

/**
 * @notice 获取 Faucet 领取锁。
 * @param address 当前钱包地址。
 * @param ip 当前请求来源 IP。
 * @returns 成功时返回锁对象；若锁已被占用则返回 `null`。
 */
export async function acquireFaucetClaimLock(
  address: `0x${string}`,
  ip: string | null
): Promise<FaucetClaimLock | null> {
  const redis = await getRequiredFaucetRedis();

  const normalizedIp = normalizeIp(ip);
  const lockSeconds = getFaucetLockTtlSeconds();
  const entries = [
    { key: getAddressLockKey(address), token: crypto.randomUUID() },
    ...(normalizedIp
      ? [{ key: getIpLockKey(normalizedIp), token: crypto.randomUUID() }]
      : []),
  ];

  const acquired: FaucetClaimLock["entries"] = [];

  for (const entry of entries) {
    const result = await redis.set(entry.key, entry.token, {
      NX: true,
      EX: lockSeconds,
    });

    if (result !== "OK") {
      if (acquired.length > 0) {
        await releaseFaucetClaimLock({ entries: acquired });
      }
      return null;
    }

    acquired.push(entry);
  }

  return { entries: acquired };
}

/**
 * @notice 释放 Faucet 领取锁。
 * @param lock 当前持有的锁对象。
 * @returns 当前函数不返回值，仅按 token 校验后删除锁键。
 */
export async function releaseFaucetClaimLock(lock: FaucetClaimLock) {
  const redis = await getRequiredFaucetRedis();

  for (const entry of lock.entries) {
    const currentToken = await redis.get(entry.key);

    if (currentToken === entry.token) {
      await redis.del(entry.key);
    }
  }
}

/**
 * @notice 标记一次 Faucet 领取完成。
 * @param record 领取记录。
 * @returns 当前函数不返回值，仅写入地址和 IP 冷却记录。
 */
export async function markFaucetClaimed(record: FaucetClaimRecord) {
  const redis = await getRequiredFaucetRedis();

  const ttl = getFaucetCooldownSeconds();
  const payload = JSON.stringify(record);
  const normalizedIp = normalizeIp(record.ip);

  await redis.set(getAddressClaimKey(record.address), payload, { EX: ttl });

  if (normalizedIp) {
    await redis.set(getIpClaimKey(normalizedIp), payload, { EX: ttl });
  }
}

function getRateLimitKey(
  kind: "nonce" | "claim",
  scope: "address" | "ip",
  value: string
) {
  return `faucet_rate:${kind}:${scope}:${value}`;
}

async function incrementRateLimitCounter(
  kind: "nonce" | "claim",
  scope: "address" | "ip",
  value: string
) {
  const redis = await getRequiredFaucetRedis();
  const key = getRateLimitKey(kind, scope, value);
  const windowSeconds = getRateLimitWindowSeconds(kind);
  const limit = getRateLimitMax(kind);
  const total = await redis.incr(key);

  if (total === 1) {
    await redis.expire(key, windowSeconds);
  }

  if (total <= limit) {
    return;
  }

  const ttl = await getPositiveTtl(redis, key);
  throw new FaucetRateLimitError(getFaucetRateLimitMessage(ttl));
}

/**
 * @notice 对 Faucet nonce 或 claim 请求执行限流。
 * @param kind 限流类型，可选 `nonce` 或 `claim`。
 * @param address 当前钱包地址。
 * @param ip 当前请求来源 IP。
 * @returns 当前函数不返回值；若超限会直接抛出 `FaucetRateLimitError`。
 */
export async function enforceFaucetRateLimit(
  kind: "nonce" | "claim",
  address: `0x${string}`,
  ip: string | null
) {
  await incrementRateLimitCounter(kind, "address", address.toLowerCase());

  const normalizedIp = normalizeIp(ip);
  if (normalizedIp) {
    await incrementRateLimitCounter(kind, "ip", normalizedIp);
  }
}
