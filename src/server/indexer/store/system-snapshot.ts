import type { PoolClient } from "pg";

export type UpsertSystemSnapshotRowInput = {
  content_owner_address?: `0x${string}`;
  votes_contract_address?: `0x${string}`;
  treasury_contract_address?: `0x${string}`;
  content_register_fee_amount: bigint;
  content_update_fee_amount: bigint;
  edit_lock_votes: bigint;
  is_allow_delete_after_vote: boolean;
  max_versions_per_content: bigint;
  treasury_owner_address?: `0x${string}`;
  epoch_budget_amount: bigint;
  epoch_spent_amount: bigint;
  timelock_min_delay_second: bigint;
  governor_token_address?: `0x${string}`;
  late_quorum_vote_extension_block: bigint;
  proposal_threshold_amount: bigint;
  proposal_fee_amount: bigint;
  voting_delay_block: bigint;
  voting_period_block: bigint;
  activation_blocks: bigint;
  cooldown_seconds: bigint;
};

export async function upsertSystemSnapshotRow(
  client: PoolClient,
  input: UpsertSystemSnapshotRowInput
) {
  await client.query(
    `
      insert into system_snapshot (
        snapshot_key,
        content_owner_address,
        votes_contract_address,
        treasury_contract_address,
        content_register_fee_amount,
        content_update_fee_amount,
        edit_lock_votes,
        is_allow_delete_after_vote,
        max_versions_per_content,
        treasury_owner_address,
        epoch_budget_amount,
        epoch_spent_amount,
        timelock_min_delay_second,
        governor_token_address,
        late_quorum_vote_extension_block,
        proposal_threshold_amount,
        proposal_fee_amount,
        voting_delay_block,
        voting_period_block,
        activation_blocks,
        cooldown_seconds
      )
      values (
        'latest',
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      on conflict (snapshot_key)
      do update
        set content_owner_address = excluded.content_owner_address,
            votes_contract_address = excluded.votes_contract_address,
            treasury_contract_address = excluded.treasury_contract_address,
            content_register_fee_amount = excluded.content_register_fee_amount,
            content_update_fee_amount = excluded.content_update_fee_amount,
            edit_lock_votes = excluded.edit_lock_votes,
            is_allow_delete_after_vote = excluded.is_allow_delete_after_vote,
            max_versions_per_content = excluded.max_versions_per_content,
            treasury_owner_address = excluded.treasury_owner_address,
            epoch_budget_amount = excluded.epoch_budget_amount,
            epoch_spent_amount = excluded.epoch_spent_amount,
            timelock_min_delay_second = excluded.timelock_min_delay_second,
            governor_token_address = excluded.governor_token_address,
            late_quorum_vote_extension_block = excluded.late_quorum_vote_extension_block,
            proposal_threshold_amount = excluded.proposal_threshold_amount,
            proposal_fee_amount = excluded.proposal_fee_amount,
            voting_delay_block = excluded.voting_delay_block,
            voting_period_block = excluded.voting_period_block,
            activation_blocks = excluded.activation_blocks,
            cooldown_seconds = excluded.cooldown_seconds,
            update_time = current_timestamp
    `,
    [
      input.content_owner_address?.toLowerCase() ?? null,
      input.votes_contract_address?.toLowerCase() ?? null,
      input.treasury_contract_address?.toLowerCase() ?? null,
      input.content_register_fee_amount.toString(),
      input.content_update_fee_amount.toString(),
      input.edit_lock_votes.toString(),
      input.is_allow_delete_after_vote ? 1 : 0,
      input.max_versions_per_content.toString(),
      input.treasury_owner_address?.toLowerCase() ?? null,
      input.epoch_budget_amount.toString(),
      input.epoch_spent_amount.toString(),
      input.timelock_min_delay_second.toString(),
      input.governor_token_address?.toLowerCase() ?? null,
      input.late_quorum_vote_extension_block.toString(),
      input.proposal_threshold_amount.toString(),
      input.proposal_fee_amount.toString(),
      input.voting_delay_block.toString(),
      input.voting_period_block.toString(),
      input.activation_blocks.toString(),
      input.cooldown_seconds.toString(),
    ]
  );
}
