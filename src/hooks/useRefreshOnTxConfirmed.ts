"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";

type RefreshCallback = () => void | Promise<void>;

export function useRefreshOnTxConfirmed() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(
    async (hash: `0x${string}`, onConfirmed?: RefreshCallback) => {
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      await queryClient.invalidateQueries();

      if (onConfirmed) {
        await onConfirmed();
      }

      router.refresh();
    },
    [publicClient, queryClient, router]
  );
}
