import type { PoolClient } from "pg";

export type UpsertRewardEventInput = {
  event_id: string;
  event_kind: "accrued" | "claimed";
  content_id?: bigint;
  author_address?: `0x${string}`;
  beneficiary_address?: `0x${string}`;
  amount: bigint;
  block_number: bigint;
  log_index: number;
  tx_hash: `0x${string}`;
  event_time?: Date;
};

export async function upsertRewardEventRow(
  client: PoolClient,
  input: UpsertRewardEventInput
) {
  await client.query(
    `
      insert into reward_event (
        event_id,
        event_kind,
        content_id,
        author_address,
        beneficiary_address,
        amount,
        block_number,
        log_index,
        tx_hash,
        event_time
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (event_id)
      do update
        set event_kind = excluded.event_kind,
            content_id = excluded.content_id,
            author_address = excluded.author_address,
            beneficiary_address = excluded.beneficiary_address,
            amount = excluded.amount,
            block_number = excluded.block_number,
            log_index = excluded.log_index,
            tx_hash = excluded.tx_hash,
            event_time = excluded.event_time,
            update_time = current_timestamp
    `,
    [
      input.event_id,
      input.event_kind,
      input.content_id?.toString() ?? null,
      input.author_address?.toLowerCase() ?? null,
      input.beneficiary_address?.toLowerCase() ?? null,
      input.amount.toString(),
      input.block_number.toString(),
      input.log_index,
      input.tx_hash,
      input.event_time ?? null,
    ]
  );
}

