"use client";

import { useEffect, useMemo, useState } from "react";
import { useBlockNumber, usePublicClient } from "wagmi";

import { usePollingEffect } from "@/hooks/usePollingEffect";

export function useLiveChainClock(input?: {
  nowIntervalMs?: number;
  blockPollIntervalMs?: number;
}) {
  const nowIntervalMs = input?.nowIntervalMs ?? 1000;
  const blockPollIntervalMs = input?.blockPollIntervalMs ?? 8000;
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  const [polledBlockNumber, setPolledBlockNumber] = useState<bigint | undefined>();

  usePollingEffect(() => {
    setNowTs(Math.floor(Date.now() / 1000));
  }, nowIntervalMs);

  usePollingEffect(
    async () => {
      if (!publicClient) {
        return;
      }

      try {
        const latestBlock = await publicClient.getBlockNumber();
        setPolledBlockNumber(latestBlock);
      } catch {
        // Keep the latest known block number when polling fails transiently.
      }
    },
    blockPollIntervalMs,
    !!publicClient
  );

  useEffect(() => {
    if (!publicClient) {
      return;
    }

    void publicClient
      .getBlockNumber()
      .then((latestBlock) => setPolledBlockNumber(latestBlock))
      .catch(() => {
        // Keep the latest known block number when the initial poll fails.
      });
  }, [publicClient]);

  const liveBlockNumber = useMemo(
    () => (typeof blockNumber === "bigint" ? blockNumber : polledBlockNumber),
    [blockNumber, polledBlockNumber]
  );

  return {
    nowTs,
    liveBlockNumber,
  };
}
