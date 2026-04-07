import { ABIS, CONTRACTS } from "@/contracts";
import {
  contentDeletedEvent,
  contentRegisteredEvent,
  contentRestoredEvent,
  contentUpdatedEvent,
  contentVersionStoredEvent,
  contentVotedEvent,
  rewardAccrueRequestedEvent,
} from "@/contracts/events";
import { collectByBlockRange } from "@/lib/block-range";
import { getServerEnv } from "@/lib/env";
import { asContentData, asContentVersion } from "@/lib/web3-types";

import { getIndexerPublicClient } from "../client";
import { getIndexerPool } from "../db";
import { setIndexerStateValue, getIndexerStateValue } from "../store/indexer-state";
import { upsertContentRow, upsertContentVersionRow } from "../store/content";

const CONTENT_LAST_SYNCED_BLOCK_STATE_KEY = "content_last_synced_block";
const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

type IndexedContentLog = {
  args: {
    id?: bigint;
    contentId?: bigint;
    version?: bigint;
  };
  blockNumber?: bigint;
  transactionHash?: `0x${string}`;
};

type ContentVersionLog = IndexedContentLog & {
  args: {
    id?: bigint;
    version?: bigint;
  };
};

type SyncContentIndexResult = {
  from_block: bigint;
  to_block: bigint;
  latest_confirmed_block: bigint;
  changed_content_count: number;
  synced_content_count: number;
  synced_version_count: number;
  skipped: boolean;
};

function getSafeConfirmedBlock(latestBlock: bigint, confirmations: number) {
  const confirmationCount = BigInt(confirmations);
  return latestBlock > confirmationCount ? latestBlock - confirmationCount : 0n;
}

async function getChangedContentIds(fromBlock: bigint, toBlock: bigint) {
  const publicClient = getIndexerPublicClient();
  const address = CONTRACTS.KnowledgeContent as `0x${string}`;
  const fetchLogs = (event: unknown) =>
    collectByBlockRange({
      fromBlock,
      toBlock,
      fetchRange: ({ fromBlock: start, toBlock: end }) =>
        publicClient.getLogs(
          {
            address,
            event: event as never,
            fromBlock: start,
            toBlock: end,
          } as never
        ) as unknown as Promise<IndexedContentLog[]>,
    });

  const [
    registeredLogs,
    updatedLogs,
    deletedLogs,
    restoredLogs,
    versionLogs,
    votedLogs,
    rewardLogs,
  ] = await Promise.all([
    fetchLogs(contentRegisteredEvent),
    fetchLogs(contentUpdatedEvent),
    fetchLogs(contentDeletedEvent),
    fetchLogs(contentRestoredEvent),
    fetchLogs(contentVersionStoredEvent),
    fetchLogs(contentVotedEvent),
    fetchLogs(rewardAccrueRequestedEvent),
  ]);

  const contentIds = new Set<bigint>();
  const versionLogMap = new Map<string, ContentVersionLog>();
  const registrationBlockMap = new Map<string, bigint>();
  const updatedBlockMap = new Map<string, bigint>();

  for (const log of registeredLogs) {
    const contentId = log.args.id;
    if (typeof contentId === "bigint") {
      contentIds.add(contentId);
      registrationBlockMap.set(contentId.toString(), log.blockNumber ?? toBlock);
      updatedBlockMap.set(contentId.toString(), log.blockNumber ?? toBlock);
    }
  }

  for (const log of updatedLogs) {
    const contentId = log.args.id;
    if (typeof contentId === "bigint") {
      contentIds.add(contentId);
      updatedBlockMap.set(contentId.toString(), log.blockNumber ?? toBlock);
    }
  }

  for (const log of deletedLogs) {
    const contentId = log.args.id;
    if (typeof contentId === "bigint") {
      contentIds.add(contentId);
      updatedBlockMap.set(contentId.toString(), log.blockNumber ?? toBlock);
    }
  }

  for (const log of restoredLogs) {
    const contentId = log.args.id;
    if (typeof contentId === "bigint") {
      contentIds.add(contentId);
      updatedBlockMap.set(contentId.toString(), log.blockNumber ?? toBlock);
    }
  }

  for (const log of versionLogs) {
    const contentId = log.args.id;
    const version = log.args.version;

    if (typeof contentId === "bigint" && typeof version === "bigint") {
      contentIds.add(contentId);
      versionLogMap.set(`${contentId}:${version}`, log as ContentVersionLog);
      updatedBlockMap.set(contentId.toString(), log.blockNumber ?? toBlock);
    }
  }

  for (const log of votedLogs) {
    const contentId = log.args.contentId;
    if (typeof contentId === "bigint") {
      contentIds.add(contentId);
      updatedBlockMap.set(contentId.toString(), log.blockNumber ?? toBlock);
    }
  }

  for (const log of rewardLogs) {
    const contentId = log.args.contentId;
    if (typeof contentId === "bigint") {
      contentIds.add(contentId);
      updatedBlockMap.set(contentId.toString(), log.blockNumber ?? toBlock);
    }
  }

  return {
    content_ids: Array.from(contentIds.values()).sort((left, right) =>
      left < right ? -1 : 1
    ),
    version_log_map: versionLogMap,
    registration_block_map: registrationBlockMap,
    updated_block_map: updatedBlockMap,
  };
}

export async function syncContentIndexOnce(): Promise<SyncContentIndexResult> {
  const env = getServerEnv();

  if (!env.INDEXER_ENABLED) {
    throw new Error("INDEXER_ENABLED must be true to run the content indexer");
  }

  const publicClient = getIndexerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const latestConfirmedBlock = getSafeConfirmedBlock(
    latestBlock,
    env.INDEXER_CONFIRMATIONS
  );
  const lastSyncedBlockValue = await getIndexerStateValue(
    CONTENT_LAST_SYNCED_BLOCK_STATE_KEY
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
      changed_content_count: 0,
      synced_content_count: 0,
      synced_version_count: 0,
      skipped: true,
    };
  }

  const { content_ids, version_log_map, registration_block_map, updated_block_map } =
    await getChangedContentIds(fromBlock, latestConfirmedBlock);

  if (content_ids.length === 0) {
    await setIndexerStateValue(
      CONTENT_LAST_SYNCED_BLOCK_STATE_KEY,
      latestConfirmedBlock.toString()
    );

    return {
      from_block: fromBlock,
      to_block: latestConfirmedBlock,
      latest_confirmed_block: latestConfirmedBlock,
      changed_content_count: 0,
      synced_content_count: 0,
      synced_version_count: 0,
      skipped: false,
    };
  }

  const pool = getIndexerPool();
  const client = await pool.connect();
  let syncedVersionCount = 0;

  try {
    await client.query("begin");

    for (const contentId of content_ids) {
      const [contentResult, rewardAccrualCount, versionCount] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "contents",
          args: [contentId],
        }),
        publicClient.readContract({
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "rewardAccrualCount",
          args: [contentId],
        }),
        publicClient.readContract({
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "contentVersionCount",
          args: [contentId],
        }),
      ]);

      const content = asContentData(contentResult);

      if (!content) {
        continue;
      }

      const createdBlockNumber =
        registration_block_map.get(contentId.toString()) ??
        updated_block_map.get(contentId.toString()) ??
        latestConfirmedBlock;
      const updatedBlockNumber =
        updated_block_map.get(contentId.toString()) ?? latestConfirmedBlock;

      await upsertContentRow(client, {
        content,
        version_count: versionCount as bigint,
        reward_accrual_count: rewardAccrualCount as bigint,
        created_block_number: createdBlockNumber,
        updated_block_number: updatedBlockNumber,
      });

      const versionsToSync = new Set<bigint>();
      const totalVersionCount = Number(versionCount as bigint);

      for (let version = 1; version <= totalVersionCount; version += 1) {
        const versionNumber = BigInt(version);
        if (version_log_map.has(`${contentId}:${versionNumber}`) || fromBlock === BigInt(env.INDEXER_START_BLOCK)) {
          versionsToSync.add(versionNumber);
        }
      }

      for (const versionNumber of versionsToSync) {
        const versionResult = await publicClient.readContract({
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "getContentVersion",
          args: [contentId, versionNumber],
        });
        const version = asContentVersion(versionResult, versionNumber);

        if (!version) {
          continue;
        }

        const versionLog = version_log_map.get(`${contentId}:${versionNumber}`);
        await upsertContentVersionRow(client, {
          content_id: contentId,
          version_number: versionNumber,
          version,
          block_number: versionLog?.blockNumber ?? updatedBlockNumber,
          tx_hash: (versionLog?.transactionHash ?? ZERO_HASH) as `0x${string}`,
        });
        syncedVersionCount += 1;
      }
    }

    await setIndexerStateValue(
      CONTENT_LAST_SYNCED_BLOCK_STATE_KEY,
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
    changed_content_count: content_ids.length,
    synced_content_count: content_ids.length,
    synced_version_count: syncedVersionCount,
    skipped: false,
  };
}

export async function getContentIndexHealth() {
  const env = getServerEnv();
  const publicClient = getIndexerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const latestConfirmedBlock = getSafeConfirmedBlock(
    latestBlock,
    env.INDEXER_CONFIRMATIONS
  );
  const lastSyncedBlockValue = await getIndexerStateValue(
    CONTENT_LAST_SYNCED_BLOCK_STATE_KEY
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
