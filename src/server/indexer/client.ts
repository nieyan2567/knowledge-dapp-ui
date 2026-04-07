import { createPublicClient, http } from "viem";

import { getKnowledgeChain } from "@/lib/chains";
import { getServerEnv } from "@/lib/env";

let publicClient: ReturnType<typeof createPublicClient> | undefined;
let publicClientKey: string | undefined;

export function getIndexerPublicClient() {
  const env = getServerEnv();
  const rpcUrl = env.INDEXER_RPC_URL ?? env.NEXT_PUBLIC_BESU_RPC_URL;
  const cacheKey = rpcUrl;

  if (publicClient && publicClientKey === cacheKey) {
    return publicClient;
  }

  publicClient = createPublicClient({
    chain: getKnowledgeChain(),
    transport: http(rpcUrl),
  }) as ReturnType<typeof createPublicClient>;
  publicClientKey = cacheKey;

  return publicClient;
}
