import "server-only";

import { createClient } from "redis";
import { getServerEnv } from "@/lib/env";
import { captureServerException } from "@/lib/observability/server";

type KnowledgeRedisClient = ReturnType<typeof createClient>;

declare global {
  var __knowledgeRedisClient: KnowledgeRedisClient | undefined;
  var __knowledgeRedisConnectPromise:
    | Promise<KnowledgeRedisClient>
    | undefined;
}

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
