"use client";

/**
 * @notice 钱包连接状态归一化 Hook。
 * @dev 统一输出当前地址、连接状态、链 ID 以及是否位于应用要求链上的判断结果。
 */
import { useAccount, useChainId } from "wagmi";
import { getKnowledgeChain } from "@/lib/chains";

/**
 * @notice 获取钱包是否已经处于可执行业务交互的就绪状态。
 * @returns 包含钱包地址、连接状态、当前链 ID 以及是否位于正确链上的信息。
 */
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
