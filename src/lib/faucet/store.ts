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

export async function releaseFaucetClaimLock(lock: FaucetClaimLock) {
  const redis = await getRequiredFaucetRedis();

  for (const entry of lock.entries) {
    const currentToken = await redis.get(entry.key);

    if (currentToken === entry.token) {
      await redis.del(entry.key);
    }
  }
}

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
