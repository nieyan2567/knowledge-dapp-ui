/**
 * @notice 奖励事件抓取与聚合工具。
 * @dev 负责读取奖励记账与领取事件，并重建奖励历史和来源统计。
 */
import type { PublicClient } from "viem";

import { ABIS, CONTRACTS } from "@/contracts";
import { rewardAccrueRequestedEvent, rewardClaimedEvent } from "@/contracts/events";
import { collectByBlockRange } from "@/lib/block-range";
import { asContentData } from "@/lib/web3-types";

/**
 * @notice 奖励历史项结构。
 * @dev 统一表示奖励记账和奖励领取两类事件。
 */
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

/**
 * @notice 奖励来源聚合项结构。
 * @dev 按内容维度汇总奖励总额、记账次数和最新区块。
 */
export type RewardSourceItem = {
  contentId: bigint;
  title: string;
  totalAmount: bigint;
  accrualCount: number;
  latestBlock: bigint;
};

/**
 * @notice 奖励活动查询选项。
 * @dev 可按作者或受益地址过滤事件。
 */
type RewardActivityOptions = {
  author?: `0x${string}`;
  beneficiary?: `0x${string}`;
};

/**
 * @notice 抓取并聚合奖励活动数据。
 * @param publicClient 当前链的公共客户端。
 * @param options 可选过滤条件。
 * @returns 包含奖励历史列表和奖励来源聚合列表的对象。
 */
export async function fetchRewardActivity(
  publicClient: PublicClient,
  options: RewardActivityOptions = {}
) {
  const latestBlock = await publicClient.getBlockNumber();
  /**
   * @notice 并行抓取奖励记账和奖励领取两类事件。
   * @dev 两类日志互不依赖，适合同时请求以缩短等待时间。
   */
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

  /**
   * @notice 额外补充内容标题和区块时间，供页面展示完整历史记录。
   * @dev 事件自身不包含全部展示字段，因此需要并行回查内容和区块信息。
   */
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
