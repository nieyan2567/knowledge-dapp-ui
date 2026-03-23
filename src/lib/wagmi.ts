"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { knowledgeChain } from "./chains";
import { getPublicEnv } from "./env";

const env = getPublicEnv();

export const config = getDefaultConfig({
  appName: "Knowledge DApp",
  projectId: env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [knowledgeChain],
  transports: {
    [knowledgeChain.id]: http(env.NEXT_PUBLIC_BESU_RPC_URL),
  },
  ssr: true,
});
