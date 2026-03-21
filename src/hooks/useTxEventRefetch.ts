"use client";

import { useEffect } from "react";

import { subscribeTxConfirmed, type TxDomain } from "@/lib/tx-events";

type Refetcher = () => unknown | Promise<unknown>;

export function useTxEventRefetch(
  domains: readonly TxDomain[],
  refetchers: readonly Refetcher[]
) {
  useEffect(() => {
    return subscribeTxConfirmed(({ domains: changedDomains }) => {
      if (!changedDomains.some((domain) => domains.includes(domain))) {
        return;
      }

      void Promise.all(refetchers.map((refetch) => refetch()));
    });
  }, [domains, refetchers]);
}
