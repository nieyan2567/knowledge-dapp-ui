/**
 * @notice API 限流策略与执行工具。
 * @dev 支持 Redis 优先、内存回退的限流实现，并按策略名称统一限制不同接口。
 */
import "server-only";

import { getServerEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";

/**
 * @notice 当前系统支持的 API 限流策略名称集合。
 * @dev 每个名称对应一套默认的次数与时间窗口限制。
 */
export type ApiRateLimitPolicyName =
  | "global"
  | "auth:nonce"
  | "auth:verify"
  | "auth:session"
  | "auth:logout"
  | "admin:session"
  | "admin:admin-addresses:list"
  | "admin:admin-addresses:create"
  | "admin:admin-addresses:update"
  | "admin:overview"
  | "admin:network"
  | "admin:node-requests:list"
  | "admin:node-requests:create"
  | "admin:node-requests:status"
  | "admin:node-requests:approve"
  | "admin:node-requests:reject"
  | "admin:node-requests:revoke"
  | "admin:validator-requests:list"
  | "admin:validator-requests:create"
  | "admin:validator-requests:approve"
  | "admin:validator-requests:reject"
  | "admin:validator-requests:remove"
  | "ipfs:upload"
  | "client:error"
  | "faucet:nonce"
  | "faucet:claim";

/**
 * @notice 单条 API 限流策略配置。
 * @dev 由最大请求次数和时间窗口秒数组成。
 */
type ApiRateLimitPolicy = {
  max: number;
  windowSeconds: number;
};

/**
 * @notice 内存限流条目结构。
 * @dev 用于 Redis 不可用时记录当前计数和过期时间。
 */
type MemoryRateLimitEntry = {
  count: number;
  expiresAt: number;
};

/**
 * @notice 内存限流存储类型。
 * @dev 以请求键为索引，保存内存回退限流条目。
 */
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
    case "admin:session":
      return { max: 60, windowSeconds: 60 };
    case "admin:admin-addresses:list":
      return { max: 60, windowSeconds: 60 };
    case "admin:admin-addresses:create":
      return { max: 20, windowSeconds: 300 };
    case "admin:admin-addresses:update":
      return { max: 20, windowSeconds: 300 };
    case "admin:overview":
      return { max: 30, windowSeconds: 60 };
    case "admin:network":
      return { max: 30, windowSeconds: 60 };
    case "admin:node-requests:list":
      return { max: 60, windowSeconds: 60 };
    case "admin:node-requests:create":
      return { max: 20, windowSeconds: 300 };
    case "admin:node-requests:status":
      return { max: 120, windowSeconds: 60 };
    case "admin:node-requests:approve":
      return { max: 20, windowSeconds: 300 };
    case "admin:node-requests:reject":
      return { max: 20, windowSeconds: 300 };
    case "admin:node-requests:revoke":
      return { max: 20, windowSeconds: 300 };
    case "admin:validator-requests:list":
      return { max: 60, windowSeconds: 60 };
    case "admin:validator-requests:create":
      return { max: 20, windowSeconds: 300 };
    case "admin:validator-requests:approve":
      return { max: 20, windowSeconds: 300 };
    case "admin:validator-requests:reject":
      return { max: 20, windowSeconds: 300 };
    case "admin:validator-requests:remove":
      return { max: 20, windowSeconds: 300 };
    case "ipfs:upload":
      return { max: 10, windowSeconds: 300 };
    case "client:error":
      return { max: 30, windowSeconds: 60 };
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

/**
 * @notice 消耗指定策略的一次请求额度。
 * @param policyName 限流策略名称。
 * @param ip 当前请求来源 IP。
 * @returns 若仍在额度内则返回成功；否则返回重试等待秒数。
 */
async function consumeToken(policyName: ApiRateLimitPolicyName, ip: string) {
  const policy = getPolicy(policyName);
  const key = getKey(policyName, ip);
  const redis = await getRedis();

  /**
   * @notice Redis 可用时优先使用集中式计数。
   * @dev 这样多实例部署下也能共享限流状态。
   */
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

  /**
   * @notice Redis 不可用时回退到进程内限流。
   * @dev 该模式无法跨实例共享，但能在本地和降级场景下继续提供基本保护。
   */
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

/**
 * @notice 对请求头执行一组 API 限流策略检查。
 * @param headers 当前请求头对象。
 * @param policies 当前接口需要附加执行的限流策略列表。
 * @returns 通过时返回 `ok: true`；命中限流时返回错误状态和等待秒数。
 */
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

/**
 * @notice 重置内存限流状态。
 * @returns 当前函数不返回值，仅供测试环境清空限流存储。
 */
export function __resetApiRateLimitStoreForTests() {
  memoryRateLimitStore.clear();
}
