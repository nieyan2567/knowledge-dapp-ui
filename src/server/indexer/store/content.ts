import type { PoolClient } from "pg";

import type { ContentData, ContentVersionData } from "@/types/content";

export type UpsertContentRowInput = {
  content: ContentData;
  version_count: bigint;
  reward_accrual_count: bigint;
  created_block_number: bigint;
  updated_block_number: bigint;
};

export type UpsertContentVersionRowInput = {
  content_id: bigint;
  version_number: bigint;
  version: ContentVersionData;
  block_number: bigint;
  tx_hash: `0x${string}`;
};

export async function upsertContentRow(
  client: PoolClient,
  input: UpsertContentRowInput
) {
  await client.query(
    `
      insert into content (
        content_id,
        author_address,
        title,
        description,
        cid,
        latest_version,
        version_count,
        vote_count,
        reward_accrual_count,
        is_deleted,
        created_block_number,
        updated_block_number,
        created_at_second,
        last_updated_at_second
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      on conflict (content_id)
      do update
        set author_address = excluded.author_address,
            title = excluded.title,
            description = excluded.description,
            cid = excluded.cid,
            latest_version = excluded.latest_version,
            version_count = excluded.version_count,
            vote_count = excluded.vote_count,
            reward_accrual_count = excluded.reward_accrual_count,
            is_deleted = excluded.is_deleted,
            updated_block_number = excluded.updated_block_number,
            last_updated_at_second = excluded.last_updated_at_second,
            update_time = current_timestamp
    `,
    [
      input.content.id.toString(),
      input.content.author.toLowerCase(),
      input.content.title,
      input.content.description,
      input.content.ipfsHash,
      input.content.latestVersion.toString(),
      input.version_count.toString(),
      input.content.voteCount.toString(),
      input.reward_accrual_count.toString(),
      input.content.deleted ? 1 : 0,
      input.created_block_number.toString(),
      input.updated_block_number.toString(),
      input.content.timestamp.toString(),
      input.content.lastUpdatedAt.toString(),
    ]
  );
}

export async function upsertContentVersionRow(
  client: PoolClient,
  input: UpsertContentVersionRowInput
) {
  await client.query(
    `
      insert into content_version (
        content_id,
        version_number,
        title,
        description,
        cid,
        block_number,
        tx_hash,
        version_timestamp_second
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (content_id, version_number)
      do update
        set title = excluded.title,
            description = excluded.description,
            cid = excluded.cid,
            block_number = excluded.block_number,
            tx_hash = excluded.tx_hash,
            version_timestamp_second = excluded.version_timestamp_second,
            update_time = current_timestamp
    `,
    [
      input.content_id.toString(),
      input.version_number.toString(),
      input.version.title,
      input.version.description,
      input.version.ipfsHash,
      input.block_number.toString(),
      input.tx_hash,
      input.version.timestamp.toString(),
    ]
  );
}
