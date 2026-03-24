"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useSignMessage } from "wagmi";

import { useWalletReady } from "@/hooks/useWalletReady";
import {
  buildUploadAuthMessage,
  type UploadAuthChallenge,
} from "@/lib/auth/message";
import { knowledgeChain } from "@/lib/chains";
import { reportClientError } from "@/lib/observability/client";

type UploadSessionResponse = {
  authenticated: boolean;
  address?: `0x${string}`;
  chainId?: number;
};

type UploadNonceErrorResponse = {
  error?: string;
};

export function useUploadAuth() {
  const { address, chainId, isConnected, isCorrectChain } = useWalletReady();
  const { signMessageAsync } = useSignMessage();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const ensureUploadAuth = useCallback(async () => {
    if (!isConnected || !address) {
      toast.error("请先连接钱包");
      return false;
    }

    if (!isCorrectChain) {
      toast.error(`请切换到 ${knowledgeChain.name}`);
      return false;
    }

    try {
      const sessionRes = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (sessionRes.ok) {
        const session = (await sessionRes.json()) as UploadSessionResponse;

        if (
          session.authenticated &&
          session.address?.toLowerCase() === address.toLowerCase() &&
          session.chainId === chainId
        ) {
          return true;
        }
      }
    } catch (error) {
      void reportClientError({
        message: "Failed to read upload session",
        source: "upload-auth.session-check",
        severity: "warn",
        handled: true,
        error,
      });
    }

    const loadingToastId = toast.loading("正在验证上传身份...");
    setIsAuthenticating(true);

    try {
      const nonceRes = await fetch("/api/auth/nonce", {
        cache: "no-store",
        credentials: "same-origin",
      });

      const nonceData = (await nonceRes.json()) as
        | UploadAuthChallenge
        | UploadNonceErrorResponse;
      const nonceError = "nonce" in nonceData ? undefined : nonceData.error;

      if (!nonceRes.ok || !("nonce" in nonceData)) {
        throw new Error(nonceError || "获取签名挑战失败");
      }

      const message = buildUploadAuthMessage(nonceData, address);
      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          address,
          nonce: nonceData.nonce,
          signature,
        }),
      });

      const verifyData = (await verifyRes.json()) as { error?: string };

      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "上传身份验证失败");
      }

      toast.success("上传身份验证成功", { id: loadingToastId });
      return true;
    } catch (error) {
      void reportClientError({
        message: "Upload auth failed",
        source: "upload-auth.authenticate",
        severity: "error",
        handled: true,
        error,
        context: {
          address,
          chainId,
        },
      });
      toast.error(error instanceof Error ? error.message : "上传身份验证失败", {
        id: loadingToastId,
      });
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, chainId, isConnected, isCorrectChain, signMessageAsync]);

  return {
    ensureUploadAuth,
    isAuthenticating,
  };
}
