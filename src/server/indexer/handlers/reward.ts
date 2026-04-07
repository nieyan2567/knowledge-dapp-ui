import { ABIS, CONTRACTS } from "@/contracts";
import {
  rewardAccrueRequestedEvent,
  rewardClaimedEvent,
} from "@/contracts/events";
import { collectByBlockRange } from "@/lib/block-range";
import { getServerEnv } from "@/lib/env";

import { getIndexerPublicClient } from "../client";
import { getIndexerPool } from "../db";
import { syncStateKey } from "../types";
import { getIndexerStateValue, setIndexerStateValue } from "../store/indexer-state";
import { upsertRewardEventRow } from "../store/reward";
import { upsertRewardSnapshotRow } from "../store/user-snapshot";

const REWARD_LAST_SYNCED_BLOCK_STATE_KEY: syncStateKey =
  "reward_last_synced_block";

type IndexedRewardAccrualLog = {
  args: {
    contentId?: bigint;
    author?: `0x${string}`;
    amount?: bigint;
  };
  blockNumber?: bigint;
  logIndex?: number;
  transactionHash?: `0x${string}`;
};

type IndexedRewardClaimLog = {
  args: {
    beneficiary?: `0x${string}`;
    amount?: bigint;
  };
  blockNumber?: bigint;
  logIndex?: number;
  transactionHash?: `0x${string}`;
};

type SyncRewardIndexResult = {
  from_block: bigint;
  to_block: bigint;
  latest_confirmed_block: bigint;
  synced_reward_event_count: number;
  skipped: boolean;
};

function getSafeConfirmedBlock(latestBlock: bigint, confirmations: number) {
  const confirmationCount = BigInt(confirmations);
  return latestBlock > confirmationCount ? latestBlock - confirmationCount : 0n;
}

export async function syncRewardIndexOnce(): Promise<SyncRewardIndexResult> {
  const env = getServerEnv();

  if (!env.INDEXER_ENABLED) {
    throw new Error("INDEXER_ENABLED must be true to run the reward indexer");
  }

  const publicClient = getIndexerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const latestConfirmedBlock = getSafeConfirmedBlock(
    latestBlock,
    env.INDEXER_CONFIRMATIONS
  );
  const lastSyncedBlockValue = await getIndexerStateValue(
    REWARD_LAST_SYNCED_BLOCK_STATE_KEY
  );
  const lastSyncedBlock =
    lastSyncedBlockValue !== undefined
      ? BigInt(lastSyncedBlockValue)
      : BigInt(env.INDEXER_START_BLOCK) - 1n;
  const fromBlock = lastSyncedBlock + 1n;

  if (fromBlock > latestConfirmedBlock) {
    return {
      from_block: fromBlock,
      to_block: latestConfirmedBlock,
      latest_confirmed_block: latestConfirmedBlock,
      synced_reward_event_count: 0,
      skipped: true,
    };
  }

  const [accrualLogs, claimLogs] = await Promise.all([
    collectByBlockRange({
      fromBlock,
      toBlock: latestConfirmedBlock,
      fetchRange: ({ fromBlock: start, toBlock: end }) =>
        publicClient.getLogs(
          {
            address: CONTRACTS.KnowledgeContent as `0x${string}`,
            event: rewardAccrueRequestedEvent as never,
            fromBlock: start,
            toBlock: end,
          } as never
        ) as unknown as Promise<IndexedRewardAccrualLog[]>,
    }),
    collectByBlockRange({
      fromBlock,
      toBlock: latestConfirmedBlock,
      fetchRange: ({ fromBlock: start, toBlock: end }) =>
        publicClient.getLogs(
          {
            address: CONTRACTS.TreasuryNative as `0x${string}`,
            event: rewardClaimedEvent as never,
            fromBlock: start,
            toBlock: end,
          } as never
        ) as unknown as Promise<IndexedRewardClaimLog[]>,
    }),
  ]);

  const logsWithBlocks = Array.from(
    new Set(
      [...accrualLogs, ...claimLogs]
        .map((log) => log.blockNumber)
        .filter((blockNumber): blockNumber is bigint => typeof blockNumber === "bigint")
    ).values()
  );
  const blockTimestampMap = new Map<string, Date>();

  if (logsWithBlocks.length > 0) {
    const blocks = await Promise.all(
      logsWithBlocks.map(async (blockNumber) => {
        const block = await publicClient.getBlock({ blockNumber });
        return [blockNumber.toString(), new Date(Number(block.timestamp) * 1000)] as const;
      })
    );

    for (const [key, value] of blocks) {
      blockTimestampMap.set(key, value);
    }
  }

  if (accrualLogs.length === 0 && claimLogs.length === 0) {
    await setIndexerStateValue(
      REWARD_LAST_SYNCED_BLOCK_STATE_KEY,
      latestConfirmedBlock.toString()
    );

    return {
      from_block: fromBlock,
      to_block: latestConfirmedBlock,
      latest_confirmed_block: latestConfirmedBlock,
      synced_reward_event_count: 0,
      skipped: false,
    };
  }

  const pool = getIndexerPool();
  const client = await pool.connect();
  const touchedAddresses = new Set<`0x${string}`>();

  try {
    await client.query("begin");

    for (const log of accrualLogs) {
      const txHash = log.transactionHash;
      const logIndex = log.logIndex;
      const blockNumber = log.blockNumber;

      if (
        !txHash ||
        logIndex === undefined ||
        blockNumber === undefined ||
        log.args.contentId === undefined ||
        log.args.amount === undefined
      ) {
        continue;
      }

      await upsertRewardEventRow(client, {
        event_id: `${txHash}:accrued:${logIndex}`,
        event_kind: "accrued",
        content_id: log.args.contentId,
        author_address: log.args.author,
        amount: log.args.amount,
        block_number: blockNumber,
        log_index: logIndex,
        tx_hash: txHash,
        event_time: blockTimestampMap.get(blockNumber.toString()),
      });

      if (log.args.author) {
        touchedAddresses.add(log.args.author.toLowerCase() as `0x${string}`);
      }
    }

    for (const log of claimLogs) {
      const txHash = log.transactionHash;
      const logIndex = log.logIndex;
      const blockNumber = log.blockNumber;

      if (
        !txHash ||
        logIndex === undefined ||
        blockNumber === undefined ||
        log.args.amount === undefined
      ) {
        continue;
      }

      await upsertRewardEventRow(client, {
        event_id: `${txHash}:claimed:${logIndex}`,
        event_kind: "claimed",
        beneficiary_address: log.args.beneficiary,
        amount: log.args.amount,
        block_number: blockNumber,
        log_index: logIndex,
        tx_hash: txHash,
        event_time: blockTimestampMap.get(blockNumber.toString()),
      });

      if (log.args.beneficiary) {
        touchedAddresses.add(log.args.beneficiary.toLowerCase() as `0x${string}`);
      }
    }

    for (const userAddress of touchedAddresses) {
      const pendingRewardAmount = await publicClient.readContract({
        address: CONTRACTS.TreasuryNative as `0x${string}`,
        abi: ABIS.TreasuryNative,
        functionName: "pendingRewards",
        args: [userAddress],
      });

      await upsertRewardSnapshotRow(client, {
        user_address: userAddress,
        pending_reward_amount: pendingRewardAmount as bigint,
      });
    }

    await setIndexerStateValue(
      REWARD_LAST_SYNCED_BLOCK_STATE_KEY,
      latestConfirmedBlock.toString(),
      client
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return {
    from_block: fromBlock,
    to_block: latestConfirmedBlock,
    latest_confirmed_block: latestConfirmedBlock,
    synced_reward_event_count: accrualLogs.length + claimLogs.length,
    skipped: false,
  };
}

export async function getRewardIndexHealth() {
  const env = getServerEnv();
  const publicClient = getIndexerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const latestConfirmedBlock = getSafeConfirmedBlock(
    latestBlock,
    env.INDEXER_CONFIRMATIONS
  );
  const lastSyncedBlockValue = await getIndexerStateValue(
    REWARD_LAST_SYNCED_BLOCK_STATE_KEY
  );
  const lastSyncedBlock =
    lastSyncedBlockValue !== undefined ? BigInt(lastSyncedBlockValue) : null;

  return {
    enabled: env.INDEXER_ENABLED,
    start_block: env.INDEXER_START_BLOCK,
    latest_block: latestBlock.toString(),
    latest_confirmed_block: latestConfirmedBlock.toString(),
    last_synced_block: lastSyncedBlock?.toString() ?? null,
    lag_blocks:
      lastSyncedBlock === null
        ? latestConfirmedBlock.toString()
        : (latestConfirmedBlock - lastSyncedBlock).toString(),
  };
}
