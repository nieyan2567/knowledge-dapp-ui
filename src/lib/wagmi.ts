"use client";

/**
 * @notice Wagmi 配置工厂。
 * @dev 基于当前公开环境变量和知识链配置生成并缓存 RainbowKit / Wagmi 配置对象。
 */
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { getKnowledgeChain } from "./chains";
import { getPublicRuntimeEnv } from "./env";

let cachedWagmiConfig: ReturnType<typeof getDefaultConfig> | undefined;
let cachedWagmiConfigKey: string | undefined;

/**
 * @notice 获取当前前端运行时使用的 Wagmi 配置。
 * @returns 供 `WagmiProvider` 使用的配置对象。
 */
export function getWagmiConfig() {
  const env = getPublicRuntimeEnv();
  const knowledgeChain = getKnowledgeChain();
  const cacheKey = JSON.stringify({
    chainId: knowledgeChain.id,
    rpcUrl: env.NEXT_PUBLIC_BESU_RPC_URL,
    projectId: env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  });

  /**
   * @notice 仅在链配置或 RPC 参数变化时重新创建 Wagmi 配置。
   * @dev 通过缓存避免客户端重复实例化连接器与传输层配置。
   */
  if (cachedWagmiConfig && cachedWagmiConfigKey === cacheKey) {
    return cachedWagmiConfig;
  }

  cachedWagmiConfig = getDefaultConfig({
    appName: "Knowledge DApp",
    projectId: env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    chains: [knowledgeChain],
    transports: {
      [knowledgeChain.id]: http(env.NEXT_PUBLIC_BESU_RPC_URL),
    },
    ssr: true,
  });
  cachedWagmiConfigKey = cacheKey;

  return cachedWagmiConfig;
}
