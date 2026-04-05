"use client";

import { useAccount, useChainId } from "wagmi";
import { getKnowledgeChain } from "@/lib/chains";

export function useWalletReady() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const knowledgeChain = getKnowledgeChain();

  return {
    address,
    isConnected,
    isCorrectChain: chainId === knowledgeChain.id,
    chainId,
  };
}
