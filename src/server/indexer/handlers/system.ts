import { ABIS, CONTRACTS } from "@/contracts";
import { getServerEnv } from "@/lib/env";

import { getIndexerPublicClient } from "../client";
import { getIndexerPool } from "../db";
import { getIndexerStateValue, setIndexerStateValue } from "../store/indexer-state";
import { upsertSystemSnapshotRow } from "../store/system-snapshot";
import type { syncStateKey } from "../types";

const SYSTEM_LAST_SYNCED_BLOCK_STATE_KEY: syncStateKey = "system_last_synced_block";

type SyncSystemIndexResult = {
  latest_confirmed_block: bigint;
  synced: boolean;
};

function getSafeConfirmedBlock(latestBlock: bigint, confirmations: number) {
  const confirmationCount = BigInt(confirmations);
  return latestBlock > confirmationCount ? latestBlock - confirmationCount : 0n;
}

export async function syncSystemIndexOnce(): Promise<SyncSystemIndexResult> {
  const env = getServerEnv();

  if (!env.INDEXER_ENABLED) {
    throw new Error("INDEXER_ENABLED must be true to run the system indexer");
  }

  const publicClient = getIndexerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const latestConfirmedBlock = getSafeConfirmedBlock(
    latestBlock,
    env.INDEXER_CONFIRMATIONS
  );
  const pool = getIndexerPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const [
      contentOwner,
      votesContract,
      treasuryContract,
      registerFee,
      updateFee,
      editLockVotes,
      allowDeleteAfterVote,
      maxVersionsPerContent,
      treasuryOwner,
      epochBudget,
      epochSpent,
      minDelay,
      governorToken,
      lateQuorumVoteExtension,
      proposalThreshold,
      proposalFee,
      votingDelay,
      votingPeriod,
      activationBlocks,
      cooldownSeconds,
    ] = await Promise.all([
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "owner",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "votesContract",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "treasury",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "registerFee",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "updateFee",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "editLockVotes",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "allowDeleteAfterVote",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "maxVersionsPerContent",
      }),
      publicClient.readContract({
        address: CONTRACTS.TreasuryNative as `0x${string}`,
        abi: ABIS.TreasuryNative,
        functionName: "owner",
      }),
      publicClient.readContract({
        address: CONTRACTS.TreasuryNative as `0x${string}`,
        abi: ABIS.TreasuryNative,
        functionName: "epochBudget",
      }),
      publicClient.readContract({
        address: CONTRACTS.TreasuryNative as `0x${string}`,
        abi: ABIS.TreasuryNative,
        functionName: "epochSpent",
      }),
      publicClient.readContract({
        address: CONTRACTS.TimelockController as `0x${string}`,
        abi: ABIS.TimelockController,
        functionName: "getMinDelay",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "token",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "lateQuorumVoteExtension",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "proposalThreshold",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "proposalFee",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "votingDelay",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "votingPeriod",
      }),
      publicClient.readContract({
        address: CONTRACTS.NativeVotes as `0x${string}`,
        abi: ABIS.NativeVotes,
        functionName: "activationBlocks",
      }),
      publicClient.readContract({
        address: CONTRACTS.NativeVotes as `0x${string}`,
        abi: ABIS.NativeVotes,
        functionName: "cooldownSeconds",
      }),
    ]);

    await upsertSystemSnapshotRow(client, {
      content_owner_address: contentOwner as `0x${string}`,
      votes_contract_address: votesContract as `0x${string}`,
      treasury_contract_address: treasuryContract as `0x${string}`,
      content_register_fee_amount: registerFee as bigint,
      content_update_fee_amount: updateFee as bigint,
      edit_lock_votes: editLockVotes as bigint,
      is_allow_delete_after_vote: Boolean(allowDeleteAfterVote),
      max_versions_per_content: maxVersionsPerContent as bigint,
      treasury_owner_address: treasuryOwner as `0x${string}`,
      epoch_budget_amount: epochBudget as bigint,
      epoch_spent_amount: epochSpent as bigint,
      timelock_min_delay_second: minDelay as bigint,
      governor_token_address: governorToken as `0x${string}`,
      late_quorum_vote_extension_block: lateQuorumVoteExtension as bigint,
      proposal_threshold_amount: proposalThreshold as bigint,
      proposal_fee_amount: proposalFee as bigint,
      voting_delay_block: votingDelay as bigint,
      voting_period_block: votingPeriod as bigint,
      activation_blocks: activationBlocks as bigint,
      cooldown_seconds: cooldownSeconds as bigint,
    });

    await setIndexerStateValue(
      SYSTEM_LAST_SYNCED_BLOCK_STATE_KEY,
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
    latest_confirmed_block: latestConfirmedBlock,
    synced: true,
  };
}

export async function getSystemIndexHealth() {
  const env = getServerEnv();
  const publicClient = getIndexerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const latestConfirmedBlock = getSafeConfirmedBlock(
    latestBlock,
    env.INDEXER_CONFIRMATIONS
  );
  const lastSyncedBlockValue = await getIndexerStateValue(
    SYSTEM_LAST_SYNCED_BLOCK_STATE_KEY
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
