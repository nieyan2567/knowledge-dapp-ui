import { defineChain } from "viem";
import { BRANDING } from "./branding";

const chainId = Number(process.env.NEXT_PUBLIC_BESU_CHAIN_ID || "20260");
const rpcUrl = process.env.NEXT_PUBLIC_BESU_RPC_URL || "http://127.0.0.1:8545";
const explorerUrl = process.env.NEXT_PUBLIC_CHAINLENS_URL || "http://127.0.0.1:8181";

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