import type { Pool, PoolClient } from "pg";

import { getIndexerPool } from "../db";

type IndexerDbClient = Pool | PoolClient;

export async function getIndexerStateValue(
  stateKey: string,
  client: IndexerDbClient = getIndexerPool()
) {
  const result = await client.query<{ state_value: string }>(
    `
      select state_value
      from indexer_state
      where state_key = $1
      limit 1
    `,
    [stateKey]
  );

  return result.rows[0]?.state_value;
}

export async function setIndexerStateValue(
  stateKey: string,
  stateValue: string,
  client: IndexerDbClient = getIndexerPool()
) {
  await client.query(
    `
      insert into indexer_state (state_key, state_value)
      values ($1, $2)
      on conflict (state_key)
      do update
        set state_value = excluded.state_value,
            update_time = current_timestamp
    `,
    [stateKey, stateValue]
  );
}

