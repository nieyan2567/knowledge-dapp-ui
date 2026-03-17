"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { knowledgeChain } from "./chains";

export const config = getDefaultConfig({
  appName: "Knowledge DApp",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  chains: [knowledgeChain],
  transports: {
    [knowledgeChain.id]: http(
      process.env.NEXT_PUBLIC_BESU_RPC_URL || "http://127.0.0.1:8545"),
  },
  ssr: true,
});