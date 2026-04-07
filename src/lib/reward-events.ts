import type { PublicClient } from "viem";

import { ABIS, CONTRACTS } from "@/contracts";
import { rewardAccrueRequestedEvent, rewardClaimedEvent } from "@/contracts/events";
import { collectByBlockRange } from "@/lib/block-range";
import { asContentData } from "@/lib/web3-types";

export type RewardHistoryItem = {
  id: string;
  kind: "accrued" | "claimed";
  amount: bigint;
  blockNumber: bigint;
  timestamp?: bigint;
  contentId?: bigint;
  contentTitle?: string;
  txHash?: `0x${string}`;
  beneficiary?: `0x${string}`;
  author?: `0x${string}`;
  voteCountAtAccrual?: bigint;
};

export type RewardSourceItem = {
  contentId: bigint;
  title: string;
  totalAmount: bigint;
  accrualCount: number;
  latestBlock: bigint;
};

type RewardActivityOptions = {
  author?: `0x${string}`;
  beneficiary?: `0x${string}`;
};

export type RewardActivityResult = {
  historyItems: RewardHistoryItem[];
  rewardSources: RewardSourceItem[];
};

export async function fetchRewardActivity(
  publicClient: PublicClient,
  options: RewardActivityOptions = {}
): Promise<RewardActivityResult> {
  const latestBlock = await publicClient.getBlockNumber();
  const [accrualLogs, claimLogs] = await Promise.all([
    collectByBlockRange({
      toBlock: latestBlock,
      fetchRange: ({ fromBlock, toBlock }) =>
        publicClient.getLogs({
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          event: rewardAccrueRequestedEvent,
          args: options.author ? { author: options.author } : undefined,
          fromBlock,
          toBlock,
        }),
    }),
    collectByBlockRange({
      toBlock: latestBlock,
      fetchRange: ({ fromBlock, toBlock }) =>
        publicClient.getLogs({
          address: CONTRACTS.TreasuryNative as `0x${string}`,
          event: rewardClaimedEvent,
          args: options.beneficiary ? { beneficiary: options.beneficiary } : undefined,
          fromBlock,
          toBlock,
        }),
    }),
  ]);

  const contentIds = Array.from(
    new Set(
      accrualLogs
        .map((log) => log.args.contentId)
        .filter((contentId): contentId is bigint => typeof contentId === "bigint")
    )
  );

  const blockNumbers = Array.from(
    new Set(
      [...accrualLogs, ...claimLogs]
        .map((log) => log.blockNumber)
        .filter((blockNumber): blockNumber is bigint => typeof blockNumber === "bigint")
    )
  );

  const [contentEntries, blockEntries] = await Promise.all([
    Promise.all(
      contentIds.map(async (contentId) => {
        const result = await publicClient.readContract({
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "contents",
          args: [contentId],
        });

        return [contentId.toString(), asContentData(result)] as const;
      })
    ),
    Promise.all(
      blockNumbers.map(async (blockNumber) => {
        const block = await publicClient.getBlock({ blockNumber });
        return [blockNumber.toString(), block.timestamp] as const;
      })
    ),
  ]);

  const contentMap = new Map(contentEntries);
  const blockTimestampMap = new Map(blockEntries);

  const historyItems: RewardHistoryItem[] = [
    ...accrualLogs.map((log) => {
      const contentId = log.args.contentId;
      const blockNumber = log.blockNumber ?? 0n;
      const content = contentId ? contentMap.get(contentId.toString()) : undefined;

      return {
        id: `${log.transactionHash ?? "0x"}-accrued-${contentId?.toString() ?? "0"}`,
        kind: "accrued" as const,
        amount: log.args.amount ?? 0n,
        blockNumber,
        timestamp: blockTimestampMap.get(blockNumber.toString()),
        contentId,
        contentTitle: content?.title,
        txHash: log.transactionHash ?? undefined,
        author: content?.author,
        voteCountAtAccrual: log.args.voteCountAtAccrual ?? undefined,
      };
    }),
    ...claimLogs.map((log) => {
      const blockNumber = log.blockNumber ?? 0n;

      return {
        id: `${log.transactionHash ?? "0x"}-claimed`,
        kind: "claimed" as const,
        amount: log.args.amount ?? 0n,
        blockNumber,
        timestamp: blockTimestampMap.get(blockNumber.toString()),
        txHash: log.transactionHash ?? undefined,
        beneficiary: log.args.beneficiary ?? undefined,
      };
    }),
  ].sort((left, right) => Number(right.blockNumber - left.blockNumber));

  const sourceMap = new Map<string, RewardSourceItem>();

  for (const log of accrualLogs) {
    const contentId = log.args.contentId;
    if (contentId === undefined) {
      continue;
    }

    const key = contentId.toString();
    const content = contentMap.get(key);
    const existing = sourceMap.get(key);

    if (existing) {
      existing.totalAmount += log.args.amount ?? 0n;
      existing.accrualCount += 1;
      if ((log.blockNumber ?? 0n) > existing.latestBlock) {
        existing.latestBlock = log.blockNumber ?? 0n;
      }
      continue;
    }

    sourceMap.set(key, {
      contentId,
      title: content?.title || `内容 #${contentId.toString()}`,
      totalAmount: log.args.amount ?? 0n,
      accrualCount: 1,
      latestBlock: log.blockNumber ?? 0n,
    });
  }

  return {
    historyItems,
    rewardSources: Array.from(sourceMap.values()).sort((left, right) =>
      Number(right.latestBlock - left.latestBlock)
    ),
  };
}
