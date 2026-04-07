import { ABIS, CONTRACTS } from "@/contracts";
import {
  activatedEvent,
  depositedEvent,
  pendingStakeCanceledEvent,
  withdrawRequestedEvent,
  withdrawnEvent,
} from "@/contracts/events";
import { collectByBlockRange } from "@/lib/block-range";
import { getServerEnv } from "@/lib/env";

import { getIndexerPublicClient } from "../client";
import { getIndexerPool } from "../db";
import { getIndexerStateValue, setIndexerStateValue } from "../store/indexer-state";
import { upsertStakeSnapshotRow } from "../store/user-snapshot";
import { syncStateKey } from "../types";

const STAKE_LAST_SYNCED_BLOCK_STATE_KEY: syncStateKey = "stake_last_synced_block";

type IndexedStakeLog = {
  args: {
    user?: `0x${string}`;
  };
  blockNumber?: bigint;
};

type SyncStakeIndexResult = {
  from_block: bigint;
  to_block: bigint;
  latest_confirmed_block: bigint;
  synced_user_count: number;
  skipped: boolean;
};

function getSafeConfirmedBlock(latestBlock: bigint, confirmations: number) {
  const confirmationCount = BigInt(confirmations);
  return latestBlock > confirmationCount ? latestBlock - confirmationCount : 0n;
}

async function getTouchedStakeUsers(fromBlock: bigint, toBlock: bigint) {
  const publicClient = getIndexerPublicClient();
  const address = CONTRACTS.NativeVotes as `0x${string}`;
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
        ) as unknown as Promise<IndexedStakeLog[]>,
    });

  const [depositedLogs, activatedLogs, canceledLogs, requestedLogs, withdrawnLogs] =
    await Promise.all([
      fetchLogs(depositedEvent),
      fetchLogs(activatedEvent),
      fetchLogs(pendingStakeCanceledEvent),
      fetchLogs(withdrawRequestedEvent),
      fetchLogs(withdrawnEvent),
    ]);

  const users = new Set<`0x${string}`>();

  for (const log of [
    ...depositedLogs,
    ...activatedLogs,
    ...canceledLogs,
    ...requestedLogs,
    ...withdrawnLogs,
  ]) {
    if (log.args.user) {
      users.add(log.args.user.toLowerCase() as `0x${string}`);
    }
  }

  return Array.from(users.values());
}

export async function syncStakeIndexOnce(): Promise<SyncStakeIndexResult> {
  const env = getServerEnv();

  if (!env.INDEXER_ENABLED) {
    throw new Error("INDEXER_ENABLED must be true to run the stake indexer");
  }

  const publicClient = getIndexerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const latestConfirmedBlock = getSafeConfirmedBlock(
    latestBlock,
    env.INDEXER_CONFIRMATIONS
  );
  const lastSyncedBlockValue = await getIndexerStateValue(
    STAKE_LAST_SYNCED_BLOCK_STATE_KEY
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
      synced_user_count: 0,
      skipped: true,
    };
  }

  const touchedUsers = await getTouchedStakeUsers(fromBlock, latestConfirmedBlock);

  if (touchedUsers.length === 0) {
    await setIndexerStateValue(
      STAKE_LAST_SYNCED_BLOCK_STATE_KEY,
      latestConfirmedBlock.toString()
    );

    return {
      from_block: fromBlock,
      to_block: latestConfirmedBlock,
      latest_confirmed_block: latestConfirmedBlock,
      synced_user_count: 0,
      skipped: false,
    };
  }

  const pool = getIndexerPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    for (const userAddress of touchedUsers) {
      const [
        voteAmount,
        stakedAmount,
        pendingStakeAmount,
        pendingWithdrawAmount,
        activateAfterBlock,
        withdrawAfterTime,
      ] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.NativeVotes as `0x${string}`,
          abi: ABIS.NativeVotes,
          functionName: "getVotes",
          args: [userAddress],
        }),
        publicClient.readContract({
          address: CONTRACTS.NativeVotes as `0x${string}`,
          abi: ABIS.NativeVotes,
          functionName: "staked",
          args: [userAddress],
        }),
        publicClient.readContract({
          address: CONTRACTS.NativeVotes as `0x${string}`,
          abi: ABIS.NativeVotes,
          functionName: "pendingStake",
          args: [userAddress],
        }),
        publicClient.readContract({
          address: CONTRACTS.NativeVotes as `0x${string}`,
          abi: ABIS.NativeVotes,
          functionName: "pendingWithdraw",
          args: [userAddress],
        }),
        publicClient.readContract({
          address: CONTRACTS.NativeVotes as `0x${string}`,
          abi: ABIS.NativeVotes,
          functionName: "activateAfterBlock",
          args: [userAddress],
        }),
        publicClient.readContract({
          address: CONTRACTS.NativeVotes as `0x${string}`,
          abi: ABIS.NativeVotes,
          functionName: "withdrawAfterTime",
          args: [userAddress],
        }),
      ]);

      const isActive =
        (voteAmount as bigint) > 0n ||
        (stakedAmount as bigint) > 0n ||
        (pendingStakeAmount as bigint) > 0n ||
        (pendingWithdrawAmount as bigint) > 0n;

      await upsertStakeSnapshotRow(client, {
        user_address: userAddress,
        vote_amount: voteAmount as bigint,
        staked_amount: stakedAmount as bigint,
        pending_stake_amount: pendingStakeAmount as bigint,
        pending_withdraw_amount: pendingWithdrawAmount as bigint,
        activate_after_block: activateAfterBlock as bigint,
        withdraw_after_time: withdrawAfterTime as bigint,
        is_active: isActive,
      });
    }

    await setIndexerStateValue(
      STAKE_LAST_SYNCED_BLOCK_STATE_KEY,
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
    synced_user_count: touchedUsers.length,
    skipped: false,
  };
}

export async function getStakeIndexHealth() {
  const env = getServerEnv();
  const publicClient = getIndexerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const latestConfirmedBlock = getSafeConfirmedBlock(
    latestBlock,
    env.INDEXER_CONFIRMATIONS
  );
  const lastSyncedBlockValue = await getIndexerStateValue(
    STAKE_LAST_SYNCED_BLOCK_STATE_KEY
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
