"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { getKnowledgeChain } from "./chains";
import { getPublicRuntimeEnv } from "./env";

let cachedWagmiConfig: ReturnType<typeof getDefaultConfig> | undefined;
let cachedWagmiConfigKey: string | undefined;

export function getWagmiConfig() {
  const env = getPublicRuntimeEnv();
  const knowledgeChain = getKnowledgeChain();
  const cacheKey = JSON.stringify({
    chainId: knowledgeChain.id,
    rpcUrl: env.NEXT_PUBLIC_BESU_RPC_URL,
    projectId: env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  });

  if (cachedWagmiConfig && cachedWagmiConfigKey === cacheKey) {
    return cachedWagmiConfig;
  }

  cachedWagmiConfig = getDefaultConfig({
    appName: "Knowledge DApp",
    projectId: env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    chains: [knowledgeChain],
    transports: {
      [knowledgeChain.id]: http(env.NEXT_PUBLIC_BESU_RPC_URL),
    },
    ssr: true,
  });
  cachedWagmiConfigKey = cacheKey;

  return cachedWagmiConfig;
}
