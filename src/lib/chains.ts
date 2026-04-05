import { defineChain } from "viem";
import { BRANDING } from "./branding";
import { getPublicRuntimeEnv } from "./env";

type KnowledgeChain = ReturnType<typeof defineChain>;

let cachedKnowledgeChain: KnowledgeChain | undefined;
let cachedKnowledgeChainKey: string | undefined;

export function getKnowledgeChain(): KnowledgeChain {
  const env = getPublicRuntimeEnv();
  const cacheKey = JSON.stringify({
    chainId: env.NEXT_PUBLIC_BESU_CHAIN_ID,
    rpcUrl: env.NEXT_PUBLIC_BESU_RPC_URL,
    explorerUrl: env.NEXT_PUBLIC_BLOCKSCOUT_URL,
  });

  if (cachedKnowledgeChain && cachedKnowledgeChainKey === cacheKey) {
    return cachedKnowledgeChain;
  }

  cachedKnowledgeChain = defineChain({
    id: env.NEXT_PUBLIC_BESU_CHAIN_ID,
    name: BRANDING.chainName,
    nativeCurrency: {
      decimals: 18,
      name: BRANDING.nativeTokenName,
      symbol: BRANDING.nativeTokenSymbol,
    },
    rpcUrls: {
      default: {
        http: [env.NEXT_PUBLIC_BESU_RPC_URL],
      },
    },
    blockExplorers: {
      default: {
        name: "Blockscout",
        url: env.NEXT_PUBLIC_BLOCKSCOUT_URL,
      },
    },
    testnet: true,
  });
  cachedKnowledgeChainKey = cacheKey;

  return cachedKnowledgeChain;
}
