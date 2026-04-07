import { getIndexerPool } from "../db";

export type IndexedSystemSnapshot = {
  content_owner_address: string | null;
  votes_contract_address: string | null;
  treasury_contract_address: string | null;
  content_register_fee_amount: string;
  content_update_fee_amount: string;
  edit_lock_votes: string;
  is_allow_delete_after_vote: number;
  max_versions_per_content: string;
  treasury_owner_address: string | null;
  epoch_budget_amount: string;
  epoch_spent_amount: string;
  timelock_min_delay_second: string;
  governor_token_address: string | null;
  late_quorum_vote_extension_block: string;
  proposal_threshold_amount: string;
  proposal_fee_amount: string;
  voting_delay_block: string;
  voting_period_block: string;
  activation_blocks: string;
  cooldown_seconds: string;
  create_time: string;
  update_time: string;
};

export async function getIndexedSystemSnapshot() {
  const pool = getIndexerPool();
  const result = await pool.query<IndexedSystemSnapshot>(
    `
      select
        nullif(btrim(content_owner_address), '') as content_owner_address,
        nullif(btrim(votes_contract_address), '') as votes_contract_address,
        nullif(btrim(treasury_contract_address), '') as treasury_contract_address,
        content_register_fee_amount::text as content_register_fee_amount,
        content_update_fee_amount::text as content_update_fee_amount,
        edit_lock_votes::text as edit_lock_votes,
        is_allow_delete_after_vote,
        max_versions_per_content::text as max_versions_per_content,
        nullif(btrim(treasury_owner_address), '') as treasury_owner_address,
        epoch_budget_amount::text as epoch_budget_amount,
        epoch_spent_amount::text as epoch_spent_amount,
        timelock_min_delay_second::text as timelock_min_delay_second,
        nullif(btrim(governor_token_address), '') as governor_token_address,
        late_quorum_vote_extension_block::text as late_quorum_vote_extension_block,
        proposal_threshold_amount::text as proposal_threshold_amount,
        proposal_fee_amount::text as proposal_fee_amount,
        voting_delay_block::text as voting_delay_block,
        voting_period_block::text as voting_period_block,
        activation_blocks::text as activation_blocks,
        cooldown_seconds::text as cooldown_seconds,
        create_time::text as create_time,
        update_time::text as update_time
      from system_snapshot
      where snapshot_key = 'latest'
      limit 1
    `
  );

  return result.rows[0] ?? null;
}
