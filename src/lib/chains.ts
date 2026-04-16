/**
 * @notice 应用链配置工厂。
 * @dev 根据公开环境变量与品牌配置构造当前前端使用的知识链定义。
 */
import { defineChain } from "viem";
import { BRANDING } from "./branding";
import { getPublicRuntimeEnv } from "./env";

/**
 * @notice 知识库应用使用的链配置类型。
 * @dev 该类型来源于 `viem` 的 `defineChain` 返回结构。
 */
type KnowledgeChain = ReturnType<typeof defineChain>;

let cachedKnowledgeChain: KnowledgeChain | undefined;
let cachedKnowledgeChainKey: string | undefined;

/**
 * @notice 获取当前环境下的知识链定义。
 * @returns 当前前端应连接的链配置对象。
 */
export function getKnowledgeChain(): KnowledgeChain {
  const env = getPublicRuntimeEnv();
  const cacheKey = JSON.stringify({
    chainId: env.NEXT_PUBLIC_BESU_CHAIN_ID,
    rpcUrl: env.NEXT_PUBLIC_BESU_RPC_URL,
    explorerUrl: env.NEXT_PUBLIC_BLOCKSCOUT_URL,
  });

  /**
   * @notice 对相同的链参数复用已构造的链定义。
   * @dev 通过缓存避免在多处读取链配置时重复创建对象。
   */
  if (cachedKnowledgeChain && cachedKnowledgeChainKey === cacheKey) {
    return cachedKnowledgeChain;
  }

  cachedKnowledgeChain = defineChain({
    id: env.NEXT_PUBLIC_BESU_CHAIN_ID,
    name: BRANDING.chainName,
    nativeCurrency: {
      decimals: 18,
      name: BRANDING.nativeTokenName,
      symbol: BRANDING.nativeTokenSymbol,
    },
    rpcUrls: {
      default: {
        http: [env.NEXT_PUBLIC_BESU_RPC_URL],
      },
    },
    blockExplorers: {
      default: {
        name: "Blockscout",
        url: env.NEXT_PUBLIC_BLOCKSCOUT_URL,
      },
    },
    testnet: true,
  });
  cachedKnowledgeChainKey = cacheKey;

  return cachedKnowledgeChain;
}
