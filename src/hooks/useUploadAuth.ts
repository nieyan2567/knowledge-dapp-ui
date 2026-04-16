"use client";

/**
 * @notice 上传鉴权 Hook。
 * @dev 负责在前端完成上传前的会话检查、挑战获取、钱包签名和服务端验签流程。
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useSignMessage } from "wagmi";

import { useWalletReady } from "@/hooks/useWalletReady";
import {
  buildUploadAuthMessage,
  type UploadAuthChallenge,
} from "@/lib/auth/message";
import { getKnowledgeChain } from "@/lib/chains";
import { reportClientError } from "@/lib/observability/client";

/**
 * @notice 上传会话查询接口返回的数据结构。
 * @dev 用于判断当前地址是否已经建立可复用的上传鉴权会话。
 */
type UploadSessionResponse = {
  authenticated: boolean;
  address?: `0x${string}`;
  chainId?: number;
};

/**
 * @notice 获取上传 nonce 失败时的接口返回结构。
 * @dev 当前接口约定在错误场景下返回 `error` 字段。
 */
type UploadNonceErrorResponse = {
  error?: string;
};

/**
 * @notice 确保当前钱包已经建立上传所需的服务端会话。
 * @returns 包含 `ensureUploadAuth` 鉴权方法和 `isAuthenticating` 鉴权状态的对象。
 */
export function useUploadAuth() {
  const { address, chainId, isConnected, isCorrectChain } = useWalletReady();
  const { signMessageAsync } = useSignMessage();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const chainName = getKnowledgeChain().name;

  const ensureUploadAuth = useCallback(async () => {
    if (!isConnected || !address) {
      toast.error("请先连接钱包");
      return false;
    }

    if (!isCorrectChain) {
      toast.error(`请切换到 ${chainName}`);
      return false;
    }

    /**
     * @notice 优先复用服务端现有上传会话。
     * @dev 若当前地址和链都与已有会话匹配，则无需再次触发钱包签名。
     */
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

    /**
     * @notice 执行完整的上传鉴权握手流程。
     * @dev 顺序为获取 nonce、构造签名消息、请求钱包签名，再将签名提交服务端验签并建立会话。
     */
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
  }, [address, chainId, chainName, isConnected, isCorrectChain, signMessageAsync]);

  return {
    ensureUploadAuth,
    isAuthenticating,
  };
}
