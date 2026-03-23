import "server-only";

import { getServerEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";

export type ApiRateLimitPolicyName =
  | "global"
  | "auth:nonce"
  | "auth:verify"
  | "auth:session"
  | "auth:logout"
  | "ipfs:upload"
  | "faucet:nonce"
  | "faucet:claim";

type ApiRateLimitPolicy = {
  max: number;
  windowSeconds: number;
};

type MemoryRateLimitEntry = {
  count: number;
  expiresAt: number;
};

type MemoryRateLimitStore = Map<string, MemoryRateLimitEntry>;

declare global {
  var __knowledgeApiRateLimitStore: MemoryRateLimitStore | undefined;
}

const memoryRateLimitStore =
  globalThis.__knowledgeApiRateLimitStore ?? new Map<string, MemoryRateLimitEntry>();

if (!globalThis.__knowledgeApiRateLimitStore) {
  globalThis.__knowledgeApiRateLimitStore = memoryRateLimitStore;
}

function getDefaultPolicy(name: ApiRateLimitPolicyName): ApiRateLimitPolicy {
  const env = getServerEnv();

  switch (name) {
    case "global":
      return {
        max: env.API_RATE_LIMIT_MAX,
        windowSeconds: env.API_RATE_LIMIT_WINDOW_SECONDS,
      };
    case "auth:nonce":
      return { max: 20, windowSeconds: 60 };
    case "auth:verify":
      return { max: 20, windowSeconds: 300 };
    case "auth:session":
      return { max: 60, windowSeconds: 60 };
    case "auth:logout":
      return { max: 20, windowSeconds: 60 };
    case "ipfs:upload":
      return { max: 10, windowSeconds: 300 };
    case "faucet:nonce":
      return { max: 20, windowSeconds: 60 };
    case "faucet:claim":
      return { max: 10, windowSeconds: 300 };
  }
}

function getPolicy(name: ApiRateLimitPolicyName) {
  const policy = getDefaultPolicy(name);

  if (!Number.isFinite(policy.max) || policy.max <= 0) {
    throw new Error(`API rate limit max for "${name}" must be a positive number`);
  }

  if (!Number.isFinite(policy.windowSeconds) || policy.windowSeconds <= 0) {
    throw new Error(
      `API rate limit window for "${name}" must be a positive number`
    );
  }

  return {
    max: Math.floor(policy.max),
    windowSeconds: Math.floor(policy.windowSeconds),
  };
}

function getRequestIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return headers.get("x-real-ip")?.trim() || "unknown";
}

function getKey(policyName: ApiRateLimitPolicyName, ip: string) {
  return `api_rate:${policyName}:${ip.toLowerCase()}`;
}

function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of memoryRateLimitStore.entries()) {
    if (entry.expiresAt <= now) {
      memoryRateLimitStore.delete(key);
    }
  }
}

async function consumeToken(policyName: ApiRateLimitPolicyName, ip: string) {
  const policy = getPolicy(policyName);
  const key = getKey(policyName, ip);
  const redis = await getRedis();

  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, policy.windowSeconds);
    }

    if (count <= policy.max) {
      return { ok: true as const };
    }

    const ttl = Math.max(await redis.ttl(key), 1);
    return {
      ok: false as const,
      retryAfterSeconds: ttl,
    };
  }

  const now = Date.now();
  cleanupExpiredEntries(now);

  const existing = memoryRateLimitStore.get(key);
  if (!existing || existing.expiresAt <= now) {
    memoryRateLimitStore.set(key, {
      count: 1,
      expiresAt: now + policy.windowSeconds * 1000,
    });
    return { ok: true as const };
  }

  existing.count += 1;
  if (existing.count <= policy.max) {
    memoryRateLimitStore.set(key, existing);
    return { ok: true as const };
  }

  return {
    ok: false as const,
    retryAfterSeconds: Math.max(Math.ceil((existing.expiresAt - now) / 1000), 1),
  };
}

export async function enforceApiRateLimits(
  headers: Headers,
  policies: ApiRateLimitPolicyName[]
) {
  const ip = getRequestIp(headers);
  const chain = ["global", ...policies] as ApiRateLimitPolicyName[];

  for (const policyName of chain) {
    const result = await consumeToken(policyName, ip);

    if (!result.ok) {
      return {
        ok: false as const,
        status: 429,
        error: `接口请求过于频繁，请在 ${result.retryAfterSeconds} 秒后重试。`,
        retryAfterSeconds: result.retryAfterSeconds,
      };
    }
  }

  return { ok: true as const };
}

export function __resetApiRateLimitStoreForTests() {
  memoryRateLimitStore.clear();
}
