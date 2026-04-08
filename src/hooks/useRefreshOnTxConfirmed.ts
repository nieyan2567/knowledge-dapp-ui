"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { emitTxConfirmed, type TxDomain } from "@/lib/tx-events";

type RefreshCallback = () => unknown | Promise<unknown>;

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
