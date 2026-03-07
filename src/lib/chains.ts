import { defineChain } from "viem";

export const besuChain = defineChain({
  id: 20260,
  name: "Besu QBFT Local",
  nativeCurrency: {
    decimals: 18,
    name: "BESU",
    symbol: "BESU",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
  blockExplorers: {
    default: {
      name: "Chainlens",
      url: "http://127.0.0.1:8080",
    },
  },
  testnet: true,
});