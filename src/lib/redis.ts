import "server-only";

import { createClient } from "redis";
import { getServerEnv } from "@/lib/env";

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
    console.error("Redis client error:", error);
  });

  return client;
}

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
