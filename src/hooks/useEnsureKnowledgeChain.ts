"use client";

/**
 * @notice 钱包链路校验与自动切链 Hook。
 * @dev 负责检测当前钱包是否连接到知识库要求的链，并在需要时尝试自动切换或注册链配置。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chain } from "viem";
import { numberToHex } from "viem";
import { toast } from "sonner";
import { useAccount } from "wagmi";

import { getKnowledgeChain } from "@/lib/chains";

/**
 * @notice 确保钱包位于知识链时的可选行为配置。
 * @dev 用于控制是否自动切链以及切链成功或失败时的提示文案。
 */
type EnsureKnowledgeChainOptions = {
  auto?: boolean;
  errorMessage?: string;
  successMessage?: string;
};

/**
 * @notice 单次确保链路时的运行参数。
 * @dev 目前仅用于控制是否静默执行，不弹出用户提示。
 */
type EnsureKnowledgeChainParams = {
  silent?: boolean;
};

/**
 * @notice 最小化的 EIP-1193 Provider 类型定义。
 * @dev 该类型只保留当前切链流程实际会使用到的 `request` 方法。
 */
type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
};

/**
 * @notice 构造钱包注册链网络时所需的参数对象。
 * @param chain 当前应用配置的链信息。
 * @returns 可直接传给 `wallet_addEthereumChain` 的参数结构。
 */
export function buildAddEthereumChainParams(chain: Chain) {
  return {
    chainId: numberToHex(chain.id),
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: chain.rpcUrls.default.http,
    blockExplorerUrls: chain.blockExplorers?.default?.url
      ? [chain.blockExplorers.default.url]
      : [],
  };
}

/**
 * @notice 判断错误是否表示钱包尚未识别当前链。
 * @param error 来自钱包请求或切链流程的异常对象。
 * @returns 若错误属于未知链场景则返回 `true`，否则返回 `false`。
 */
export function isUnknownChainError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    code?: number;
    cause?: { code?: number; message?: string };
    details?: string;
    message?: string;
    shortMessage?: string;
  };
  const message = [
    maybeError.message,
    maybeError.shortMessage,
    maybeError.details,
    maybeError.cause?.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    maybeError.code === 4902 ||
    maybeError.cause?.code === 4902 ||
    message.includes("4902") ||
    message.includes("unrecognized chain id") ||
    message.includes("unknown chain") ||
    message.includes("chain not added") ||
    message.includes("does not exist")
  );
}

/**
 * @notice 执行切换到知识链的底层钱包请求。
 * @dev 若钱包报告目标链尚未注册，则先执行加链，再重新发起切链请求。
 * @param provider 当前钱包提供的 EIP-1193 Provider。
 * @param chain 目标知识链配置。
 * @returns 切链流程完成后的 Promise。
 */
async function switchToKnowledgeChain(provider: Eip1193Provider, chain: Chain) {
  const chainId = numberToHex(chain.id);

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
    return;
  } catch (error) {
    if (!isUnknownChainError(error)) {
      throw error;
    }
  }

  await provider.request({
    method: "wallet_addEthereumChain",
    params: [buildAddEthereumChainParams(chain)],
  });
  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId }],
  });
}

/**
 * @notice 确保当前钱包已经连接到知识链。
 * @dev Hook 会返回链状态、切链控制函数和切换中的状态，并在启用自动模式时按条件触发一次静默切链。
 * @param options 控制自动切链与提示文案的配置对象。
 * @param options.auto 是否在条件满足时自动尝试切链，默认值为 `true`。
 * @param options.errorMessage 切链失败时展示的提示文案。
 * @param options.successMessage 切链成功时展示的提示文案；未提供时不展示成功提示。
 * @returns 包含目标链信息、切链方法、钱包可用状态和当前切换状态的对象。
 */
export function useEnsureKnowledgeChain({
  auto = true,
  errorMessage = "切换到 KnowChain 失败，请重试",
  successMessage,
}: EnsureKnowledgeChainOptions = {}) {
  const chain = useMemo(() => getKnowledgeChain(), []);
  const { address, chainId, connector, isConnected } = useAccount();
  const [isSwitching, setIsSwitching] = useState(false);
  const autoAttemptedRef = useRef<string | null>(null);

  const isCorrectChain = chainId === chain.id;
  const hasWalletRequest = Boolean(connector);

  const ensureChain = useCallback(
    async ({ silent = false }: EnsureKnowledgeChainParams = {}) => {
      if (!connector || !isConnected || isCorrectChain) {
        return isCorrectChain;
      }

      /**
       * @notice 统一维护切链流程的加载态。
       * @dev 进入切链前先置位，结束后无论成功失败都在 `finally` 中复位。
       */
      setIsSwitching(true);

      try {
        const provider = (await connector.getProvider()) as Eip1193Provider | undefined;
        if (!provider) {
          throw new Error("Wallet provider unavailable");
        }

        await switchToKnowledgeChain(provider, chain);

        if (!silent && successMessage) {
          toast.success(successMessage);
        }

        return true;
      } catch {
        if (!silent) {
          toast.error(errorMessage);
        }

        return false;
      } finally {
        setIsSwitching(false);
      }
    },
    [chain, connector, errorMessage, isConnected, isCorrectChain, successMessage]
  );

  useEffect(() => {
    if (!auto || !connector || !isConnected || isCorrectChain) {
      return;
    }

    /**
     * @notice 自动切链对同一钱包地址和链组合只尝试一次。
     * @dev 使用 ref 记录键值，避免组件重渲染导致钱包连续弹出多次切链确认。
     */
    const autoAttemptKey = `${address ?? "unknown"}:${chainId ?? "unknown"}`;
    if (autoAttemptedRef.current === autoAttemptKey) {
      return;
    }

    autoAttemptedRef.current = autoAttemptKey;
    void ensureChain({ silent: true });
  }, [address, auto, chainId, connector, ensureChain, isConnected, isCorrectChain]);

  useEffect(() => {
    if (isCorrectChain) {
      /**
       * @notice 当钱包已位于正确链时清空自动尝试记录。
       * @dev 这样当用户后续再次切到错误链时，自动切链逻辑仍能重新生效。
       */
      autoAttemptedRef.current = null;
    }
  }, [isCorrectChain]);

  return {
    chain,
    ensureChain,
    hasWalletRequest,
    isCorrectChain,
    isSwitching,
  };
}
