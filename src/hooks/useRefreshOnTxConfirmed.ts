"use client";

/**
 * @notice 交易确认后刷新前端状态的 Hook。
 * @dev 负责等待交易回执、广播统一事件、失效查询缓存并刷新当前路由。
 */
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { emitTxConfirmed, type TxDomain } from "@/lib/tx-events";

/**
 * @notice 交易确认后的附加刷新回调类型。
 * @dev 允许页面在通用刷新动作之外追加自己的同步或异步逻辑。
 */
type RefreshCallback = () => unknown | Promise<unknown>;

/**
 * @notice 创建一个在交易确认后执行统一刷新的函数。
 * @returns 一个可调用函数；传入交易哈希、可选确认回调和事件域后，会等待交易确认并刷新状态。
 */
export function useRefreshOnTxConfirmed() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(
    async (
      hash: `0x${string}`,
      onConfirmed?: RefreshCallback,
      domains: TxDomain[] = []
    ) => {
      /**
       * @notice 按固定顺序同步交易确认后的前端状态。
       * @dev 先等待链上回执，再广播事件、失效缓存、执行附加回调并刷新路由，避免页面读取旧数据。
       */
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      emitTxConfirmed({ hash, domains });

      await queryClient.invalidateQueries();

      if (onConfirmed) {
        await onConfirmed();
      }

      router.refresh();
    },
    [publicClient, queryClient, router]
  );
}
