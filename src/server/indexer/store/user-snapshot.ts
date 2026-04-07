import type { PoolClient } from "pg";

type UpsertStakeSnapshotRowInput = {
  user_address: `0x${string}`;
  vote_amount: bigint;
  staked_amount: bigint;
  pending_stake_amount: bigint;
  pending_withdraw_amount: bigint;
  activate_after_block: bigint;
  withdraw_after_time: bigint;
  is_active: boolean;
};

export async function upsertStakeSnapshotRow(
  client: PoolClient,
  input: UpsertStakeSnapshotRowInput
) {
  await client.query(
    `
      insert into user_snapshot (
        user_address,
        vote_amount,
        staked_amount,
        pending_stake_amount,
        pending_withdraw_amount,
        activate_after_block,
        withdraw_after_time,
        is_active
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (user_address)
      do update
        set vote_amount = excluded.vote_amount,
            staked_amount = excluded.staked_amount,
            pending_stake_amount = excluded.pending_stake_amount,
            pending_withdraw_amount = excluded.pending_withdraw_amount,
            activate_after_block = excluded.activate_after_block,
            withdraw_after_time = excluded.withdraw_after_time,
            is_active = excluded.is_active,
            update_time = current_timestamp
    `,
    [
      input.user_address.toLowerCase(),
      input.vote_amount.toString(),
      input.staked_amount.toString(),
      input.pending_stake_amount.toString(),
      input.pending_withdraw_amount.toString(),
      input.activate_after_block.toString(),
      input.withdraw_after_time.toString(),
      input.is_active ? 1 : 0,
    ]
  );
}

export async function upsertRewardSnapshotRow(
  client: PoolClient,
  input: {
    user_address: `0x${string}`;
    pending_reward_amount: bigint;
  }
) {
  await client.query(
    `
      insert into user_snapshot (
        user_address,
        pending_reward_amount
      )
      values ($1, $2)
      on conflict (user_address)
      do update
        set pending_reward_amount = excluded.pending_reward_amount,
            update_time = current_timestamp
    `,
    [input.user_address.toLowerCase(), input.pending_reward_amount.toString()]
  );
}
