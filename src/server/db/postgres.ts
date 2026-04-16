/**
 * @file PostgreSQL 访问模块。
 * @description 负责创建连接池、执行查询事务，并提供查询结果的公共封装。
 */
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

/**
 * @notice 获取全局复用的 PostgreSQL 连接池。
 * @returns `pg` 连接池实例。
 */
export function getPostgresPool() {
  const existingPool = globalThis.__knowledgePostgresPool;

  if (existingPool) {
    return existingPool;
  }

  const pool = createPostgresPool();
  globalThis.__knowledgePostgresPool = pool;
  return pool;
}

/**
 * @notice 执行一条 PostgreSQL 查询。
 * @param text SQL 文本。
 * @param params 查询参数数组。
 * @returns 查询结果对象。
 */
export async function queryPostgres<TRow extends QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return getPostgresPool().query<TRow>(text, params);
}

/**
 * @notice 在事务中执行数据库操作。
 * @param callback 持有事务客户端的异步回调。
 * @returns 回调执行结果。
 */
export async function withPostgresTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
) {
  const client = await getPostgresPool().connect();

  try {
    // 统一封装 begin / commit / rollback，避免上层重复处理事务样板代码。
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

/**
 * @notice 从查询结果中读取第一行记录。
 * @param result PostgreSQL 查询结果。
 * @returns 第一行记录。
 * @throws 当结果集为空时抛出异常。
 */
export function queryRequiredRow<TRow extends QueryResultRow>(
  result: QueryResult<TRow>
) {
  const row = result.rows[0];

  if (!row) {
    throw new Error("Expected query to return at least one row");
  }

  return row;
}
