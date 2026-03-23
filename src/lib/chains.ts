import { defineChain } from "viem";
import { BRANDING } from "./branding";
import { getPublicEnv } from "./env";

const env = getPublicEnv();
const chainId = env.NEXT_PUBLIC_BESU_CHAIN_ID;
const rpcUrl = env.NEXT_PUBLIC_BESU_RPC_URL;
const explorerUrl = env.NEXT_PUBLIC_CHAINLENS_URL;

export const knowledgeChain = defineChain({
  id: chainId,
  name: BRANDING.chainName,
  nativeCurrency: {
    decimals: 18,
    name: BRANDING.nativeTokenName,
    symbol: BRANDING.nativeTokenSymbol,
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "Chainlens",
      url: explorerUrl,
    },
  },
  testnet: true,
});
