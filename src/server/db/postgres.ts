import "server-only";

import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from "pg";

import { getServerEnv } from "@/lib/env";

declare global {
  var __knowledgePostgresPool: Pool | undefined;
}

function createPostgresPool() {
  const databaseUrl = getServerEnv().DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for PostgreSQL-backed admin storage");
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export function getPostgresPool() {
  const existingPool = globalThis.__knowledgePostgresPool;

  if (existingPool) {
    return existingPool;
  }

  const pool = createPostgresPool();
  globalThis.__knowledgePostgresPool = pool;
  return pool;
}

export async function queryPostgres<TRow extends QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return getPostgresPool().query<TRow>(text, params);
}

export async function withPostgresTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
) {
  const client = await getPostgresPool().connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export function queryRequiredRow<TRow extends QueryResultRow>(
  result: QueryResult<TRow>
) {
  const row = result.rows[0];

  if (!row) {
    throw new Error("Expected query to return at least one row");
  }

  return row;
}
