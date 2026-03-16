"use client";

import { useAccount, useChainId } from "wagmi";
import { knowledgeChain } from "@/lib/chains";

export function useWalletReady() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    return {
        address,
        isConnected,
        isCorrectChain: chainId === knowledgeChain.id,
        chainId,
    };
}