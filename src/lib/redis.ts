/**
 * @notice Redis 客户端访问封装。
 * @dev 负责创建、缓存并复用 Redis 连接，同时提供原子读取后删除的辅助方法。
 */
import "server-only";

import { createClient } from "redis";
import { getServerEnv } from "@/lib/env";
import { captureServerException } from "@/lib/observability/server";

/**
 * @notice 当前项目使用的 Redis 客户端类型。
 * @dev 直接复用 `redis` 官方客户端的返回类型。
 */
type KnowledgeRedisClient = ReturnType<typeof createClient>;

declare global {
  var __knowledgeRedisClient: KnowledgeRedisClient | undefined;
  var __knowledgeRedisConnectPromise:
    | Promise<KnowledgeRedisClient>
    | undefined;
}

/**
 * @notice 按服务端环境配置创建 Redis 客户端。
 * @returns 若配置了 Redis 地址则返回客户端，否则返回 `null`。
 */
function createRedisClient(): KnowledgeRedisClient | null {
  const { REDIS_URL: url } = getServerEnv();

  if (!url) {
    return null;
  }

  const client = createClient({ url });
  client.on("error", (error) => {
    void captureServerException("Redis client error", {
      source: "redis.client",
      severity: "error",
      error,
      alert: false,
    });
  });

  return client;
}

const ATOMIC_GET_DEL_SCRIPT = `
local value = redis.call("GET", KEYS[1])
if value then
  redis.call("DEL", KEYS[1])
end
return value
`;

/**
 * @notice 获取可复用的 Redis 客户端实例。
 * @returns 已连接的 Redis 客户端；若未配置 Redis 则返回 `null`。
 */
export async function getRedis(): Promise<KnowledgeRedisClient | null> {
  if (!getServerEnv().REDIS_URL) {
    return null;
  }

  const client =
    globalThis.__knowledgeRedisClient ?? createRedisClient();

  if (!client) {
    return null;
  }

  if (!globalThis.__knowledgeRedisClient) {
    globalThis.__knowledgeRedisClient = client;
  }

  /**
   * @notice 已建立连接时直接复用客户端。
   * @dev 避免重复发起并发连接请求。
   */
  if (client.isOpen) {
    return client;
  }

  const connectPromise =
    globalThis.__knowledgeRedisConnectPromise ??
    client.connect().then(() => client);

  if (!globalThis.__knowledgeRedisConnectPromise) {
    globalThis.__knowledgeRedisConnectPromise = connectPromise.finally(() => {
      globalThis.__knowledgeRedisConnectPromise = undefined;
    });
  }

  return globalThis.__knowledgeRedisConnectPromise;
}

/**
 * @notice 以原子方式读取并删除指定键。
 * @param key 目标 Redis 键。
 * @returns 读取到的字符串值；若键不存在或 Redis 不可用则返回 `null`。
 */
export async function atomicGetDel(key: string): Promise<string | null> {
  const client = await getRedis();

  if (!client) {
    return null;
  }

  const value = await client.sendCommand<string | null>([
    "EVAL",
    ATOMIC_GET_DEL_SCRIPT,
    "1",
    key,
  ]);

  return value ?? null;
}
