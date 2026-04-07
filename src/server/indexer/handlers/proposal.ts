import { ABIS, CONTRACTS } from "@/contracts";
import { proposalCreatedEvent } from "@/contracts/events";
import { collectByBlockRange } from "@/lib/block-range";
import { getServerEnv } from "@/lib/env";
import { parseProposalCreatedLog } from "@/lib/governance";

import { getIndexerPublicClient } from "../client";
import { getIndexerPool } from "../db";
import { syncStateKey } from "../types";
import { getIndexerStateValue, setIndexerStateValue } from "../store/indexer-state";
import { replaceProposalActions, upsertProposalRow } from "../store/proposal";

const PROPOSAL_LAST_SYNCED_BLOCK_STATE_KEY: syncStateKey =
  "proposal_last_synced_block";

type IndexedProposalLog = {
  args: {
    proposalId?: bigint;
    proposer?: `0x${string}`;
    targets?: readonly `0x${string}`[];
    values?: readonly bigint[];
    calldatas?: readonly `0x${string}`[];
    voteStart?: bigint;
    voteEnd?: bigint;
    description?: string;
  };
  blockNumber?: bigint;
  transactionHash?: `0x${string}`;
};

type SyncProposalIndexResult = {
  from_block: bigint;
  to_block: bigint;
  latest_confirmed_block: bigint;
  synced_proposal_count: number;
  skipped: boolean;
};

function getSafeConfirmedBlock(latestBlock: bigint, confirmations: number) {
  const confirmationCount = BigInt(confirmations);
  return latestBlock > confirmationCount ? latestBlock - confirmationCount : 0n;
}

export async function syncProposalIndexOnce(): Promise<SyncProposalIndexResult> {
  const env = getServerEnv();

  if (!env.INDEXER_ENABLED) {
    throw new Error("INDEXER_ENABLED must be true to run the proposal indexer");
  }

  const publicClient = getIndexerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const latestConfirmedBlock = getSafeConfirmedBlock(
    latestBlock,
    env.INDEXER_CONFIRMATIONS
  );
  const lastSyncedBlockValue = await getIndexerStateValue(
    PROPOSAL_LAST_SYNCED_BLOCK_STATE_KEY
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
      synced_proposal_count: 0,
      skipped: true,
    };
  }

  const logs = await collectByBlockRange({
    fromBlock,
    toBlock: latestConfirmedBlock,
    fetchRange: ({ fromBlock: start, toBlock: end }) =>
      publicClient.getLogs(
        {
          address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
          event: proposalCreatedEvent as never,
          fromBlock: start,
          toBlock: end,
        } as never
      ) as unknown as Promise<IndexedProposalLog[]>,
  });

  if (logs.length === 0) {
    await setIndexerStateValue(
      PROPOSAL_LAST_SYNCED_BLOCK_STATE_KEY,
      latestConfirmedBlock.toString()
    );

    return {
      from_block: fromBlock,
      to_block: latestConfirmedBlock,
      latest_confirmed_block: latestConfirmedBlock,
      synced_proposal_count: 0,
      skipped: false,
    };
  }

  const pool = getIndexerPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    for (const log of logs) {
      const proposal = parseProposalCreatedLog(log);
      const [stateValue, etaSecond, votes] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
          abi: ABIS.KnowledgeGovernor,
          functionName: "state",
          args: [proposal.proposalId],
        }),
        publicClient.readContract({
          address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
          abi: ABIS.KnowledgeGovernor,
          functionName: "proposalEta",
          args: [proposal.proposalId],
        }),
        publicClient.readContract({
          address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
          abi: ABIS.KnowledgeGovernor,
          functionName: "proposalVotes",
          args: [proposal.proposalId],
        }),
      ]);

      proposal.stateValue = stateValue as bigint;
      proposal.etaSecond = etaSecond as bigint;
      if (Array.isArray(votes) && votes.length >= 3) {
        const [againstVotes, forVotes, abstainVotes] = votes as readonly bigint[];
        proposal.votes = {
          againstVotes,
          forVotes,
          abstainVotes,
        };
      }
      await upsertProposalRow(client, proposal);
      await replaceProposalActions(client, proposal.proposalId, proposal);
    }

    await setIndexerStateValue(
      PROPOSAL_LAST_SYNCED_BLOCK_STATE_KEY,
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
    synced_proposal_count: logs.length,
    skipped: false,
  };
}

export async function getProposalIndexHealth() {
  const env = getServerEnv();
  const publicClient = getIndexerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const latestConfirmedBlock = getSafeConfirmedBlock(
    latestBlock,
    env.INDEXER_CONFIRMATIONS
  );
  const lastSyncedBlockValue = await getIndexerStateValue(
    PROPOSAL_LAST_SYNCED_BLOCK_STATE_KEY
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
