import { getIndexerPool } from "../db";

type IndexedProfileSummary = {
  address: string;
  content_count: number;
  proposal_count: number;
  vote_amount: string;
  pending_reward_amount: string;
  staked_amount: string;
  pending_stake_amount: string;
  pending_withdraw_amount: string;
  activate_after_block: string;
  withdraw_after_time: string;
  is_active: number;
  create_time: string | null;
  update_time: string | null;
};

export async function getIndexedProfileSummary(address: string) {
  const normalizedAddress = address.trim().toLowerCase();
  const pool = getIndexerPool();
  const snapshotResult = await pool.query<{
    user_address: string;
    content_count: string;
    proposal_count: string;
    vote_amount: string;
    pending_reward_amount: string;
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
        (
          select count(*)::text
          from content
          where lower(author_address) = $1
        ) as content_count,
        (
          select count(*)::text
          from proposal
          where lower(proposer_address) = $1
        ) as proposal_count,
        vote_amount::text as vote_amount,
        pending_reward_amount::text as pending_reward_amount,
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

  if (snapshotResult.rowCount && snapshotResult.rows[0]) {
    const row = snapshotResult.rows[0];

    return {
      address: row.user_address,
      content_count: Number(row.content_count),
      proposal_count: Number(row.proposal_count),
      vote_amount: row.vote_amount,
      pending_reward_amount: row.pending_reward_amount,
      staked_amount: row.staked_amount,
      pending_stake_amount: row.pending_stake_amount,
      pending_withdraw_amount: row.pending_withdraw_amount,
      activate_after_block: row.activate_after_block,
      withdraw_after_time: row.withdraw_after_time,
      is_active: row.is_active,
      create_time: row.create_time,
      update_time: row.update_time,
    } satisfies IndexedProfileSummary;
  }

  const fallbackCountsResult = await pool.query<{
    content_count: string;
    proposal_count: string;
  }>(
    `
      select
        (
          select count(*)::text
          from content
          where lower(author_address) = $1
        ) as content_count,
        (
          select count(*)::text
          from proposal
          where lower(proposer_address) = $1
        ) as proposal_count
    `,
    [normalizedAddress]
  );

  const fallback = fallbackCountsResult.rows[0];

  return {
    address: normalizedAddress,
    content_count: Number(fallback?.content_count ?? "0"),
    proposal_count: Number(fallback?.proposal_count ?? "0"),
    vote_amount: "0",
    pending_reward_amount: "0",
    staked_amount: "0",
    pending_stake_amount: "0",
    pending_withdraw_amount: "0",
    activate_after_block: "0",
    withdraw_after_time: "0",
    is_active: 1,
    create_time: null,
    update_time: null,
  } satisfies IndexedProfileSummary;
}
