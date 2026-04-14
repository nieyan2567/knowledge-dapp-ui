"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chain } from "viem";
import { numberToHex } from "viem";
import { toast } from "sonner";
import { useAccount } from "wagmi";

import { getKnowledgeChain } from "@/lib/chains";

type EnsureKnowledgeChainOptions = {
  auto?: boolean;
  errorMessage?: string;
  successMessage?: string;
};

type EnsureKnowledgeChainParams = {
  silent?: boolean;
};

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
};

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

    const autoAttemptKey = `${address ?? "unknown"}:${chainId ?? "unknown"}`;
    if (autoAttemptedRef.current === autoAttemptKey) {
      return;
    }

    autoAttemptedRef.current = autoAttemptKey;
    void ensureChain({ silent: true });
  }, [address, auto, chainId, connector, ensureChain, isConnected, isCorrectChain]);

  useEffect(() => {
    if (isCorrectChain) {
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
