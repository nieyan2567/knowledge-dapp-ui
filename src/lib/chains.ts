import { defineChain } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_BESU_CHAIN_ID || "20260");
const rpcUrl = process.env.NEXT_PUBLIC_BESU_RPC_URL || "http://127.0.0.1:8545";
const explorerUrl = process.env.NEXT_PUBLIC_CHAINLENS_URL || "http://127.0.0.1:8080";

export const besuChain = defineChain({
  id: chainId,
  name: "Besu QBFT Local",
  nativeCurrency: {
    decimals: 18,
    name: "BESU",
    symbol: "BESU",
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