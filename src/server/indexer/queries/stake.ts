import { getIndexerPool } from "../db";

export type IndexedStakeSummary = {
  address: string;
  vote_amount: string;
  staked_amount: string;
  pending_stake_amount: string;
  pending_withdraw_amount: string;
  activate_after_block: string;
  withdraw_after_time: string;
  is_active: number;
  create_time: string | null;
  update_time: string | null;
};

export async function getIndexedStakeSummary(address: string) {
  const normalizedAddress = address.trim().toLowerCase();
  const pool = getIndexerPool();
  const result = await pool.query<{
    user_address: string;
    vote_amount: string;
    staked_amount: string;
    pending_stake_amount: string;
    pending_withdraw_amount: string;
    activate_after_block: string;
    withdraw_after_time: string;
    is_active: number;
    create_time: string;
    update_time: string;
  }>(
    `
      select
        user_address,
        vote_amount::text as vote_amount,
        staked_amount::text as staked_amount,
        pending_stake_amount::text as pending_stake_amount,
        pending_withdraw_amount::text as pending_withdraw_amount,
        activate_after_block::text as activate_after_block,
        withdraw_after_time::text as withdraw_after_time,
        is_active,
        create_time::text as create_time,
        update_time::text as update_time
      from user_snapshot
      where lower(user_address) = $1
      limit 1
    `,
    [normalizedAddress]
  );

  const row = result.rows[0];

  if (!row) {
    return {
      address: normalizedAddress,
      vote_amount: "0",
      staked_amount: "0",
      pending_stake_amount: "0",
      pending_withdraw_amount: "0",
      activate_after_block: "0",
      withdraw_after_time: "0",
      is_active: 0,
      create_time: null,
      update_time: null,
    } satisfies IndexedStakeSummary;
  }

  return {
    address: row.user_address,
    vote_amount: row.vote_amount,
    staked_amount: row.staked_amount,
    pending_stake_amount: row.pending_stake_amount,
    pending_withdraw_amount: row.pending_withdraw_amount,
    activate_after_block: row.activate_after_block,
    withdraw_after_time: row.withdraw_after_time,
    is_active: row.is_active,
    create_time: row.create_time,
    update_time: row.update_time,
  } satisfies IndexedStakeSummary;
}
