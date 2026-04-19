/**
 * @file IPFS 上传记录存储模块。
 * @description 负责记录已上传但尚未上链登记的文件元数据，并在登记或清理后更新状态。
 */
import "server-only";

import { getServerEnv } from "@/lib/env";
import { queryPostgres } from "@/server/db/postgres";

/**
 * @notice IPFS 上传记录状态。
 * @dev `uploaded` 表示已上传待登记，`registered` 表示已绑定链上内容，
 * `cleaned` 表示已从本地 IPFS 回收，`cleanup_failed` 表示最近一次清理失败。
 */
export type IpfsUploadRecordStatus =
  | "uploaded"
  | "registered"
  | "cleaned"
  | "cleanup_failed";

/**
 * @notice IPFS 上传记录结构。
 * @dev 该结构既用于 PostgreSQL 查询结果，也用于无数据库时的内存回退存储。
 */
export type IpfsUploadRecord = {
  id: number;
  address: string;
  sessionId: string;
  sessionVersion: number;
  cid: string;
  fileName: string;
  fileSize: number;
  status: IpfsUploadRecordStatus;
  uploadedAt: Date;
  expiresAt: Date;
  registeredAt: Date | null;
  cleanedAt: Date | null;
  registerTxHash: string | null;
  cleanupReason: string | null;
};

/**
 * @notice 创建上传记录时需要的输入参数。
 * @dev 由上传接口在 Kubo 返回 CID 后立即写入，用于后续登记回写与孤儿清理。
 */
export type CreateIpfsUploadRecordInput = {
  address: string;
  sessionId: string;
  sessionVersion: number;
  cid: string;
  fileName: string;
  fileSize: number;
  expiresAt: Date;
};

type IpfsUploadRecordRow = {
  id: string | number;
  address: string;
  session_id: string;
  session_version: number;
  cid: string;
  file_name: string;
  file_size: string | number;
  status: IpfsUploadRecordStatus;
  uploaded_at: Date | string;
  expires_at: Date | string;
  registered_at: Date | string | null;
  cleaned_at: Date | string | null;
  register_tx_hash: string | null;
  cleanup_reason: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __knowledgeUploadRecordsFallback:
    | Map<number, IpfsUploadRecord>
    | undefined;
  // eslint-disable-next-line no-var
  var __knowledgeUploadRecordFallbackNextId: number | undefined;
}

function hasPostgresUploadStore() {
  return !!getServerEnv().DATABASE_URL;
}

function getFallbackStore() {
  if (!globalThis.__knowledgeUploadRecordsFallback) {
    globalThis.__knowledgeUploadRecordsFallback = new Map<number, IpfsUploadRecord>();
  }

  if (!globalThis.__knowledgeUploadRecordFallbackNextId) {
    globalThis.__knowledgeUploadRecordFallbackNextId = 1;
  }

  return globalThis.__knowledgeUploadRecordsFallback;
}

function nextFallbackId() {
  const current = globalThis.__knowledgeUploadRecordFallbackNextId ?? 1;
  globalThis.__knowledgeUploadRecordFallbackNextId = current + 1;
  return current;
}

function normalizeDate(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

function normalizeRecord(row: IpfsUploadRecordRow): IpfsUploadRecord {
  return {
    id: Number(row.id),
    address: row.address,
    sessionId: row.session_id,
    sessionVersion: row.session_version,
    cid: row.cid,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    status: row.status,
    uploadedAt: normalizeDate(row.uploaded_at) ?? new Date(0),
    expiresAt: normalizeDate(row.expires_at) ?? new Date(0),
    registeredAt: normalizeDate(row.registered_at),
    cleanedAt: normalizeDate(row.cleaned_at),
    registerTxHash: row.register_tx_hash,
    cleanupReason: row.cleanup_reason,
  };
}

/**
 * @notice 创建一条新的 IPFS 上传记录。
 * @param input 上传成功后需要落库的记录字段。
 * @returns 新创建的上传记录。
 */
export async function createIpfsUploadRecord(
  input: CreateIpfsUploadRecordInput
) {
  if (!hasPostgresUploadStore()) {
    const id = nextFallbackId();
    const record: IpfsUploadRecord = {
      id,
      address: input.address,
      sessionId: input.sessionId,
      sessionVersion: input.sessionVersion,
      cid: input.cid,
      fileName: input.fileName,
      fileSize: input.fileSize,
      status: "uploaded",
      uploadedAt: new Date(),
      expiresAt: input.expiresAt,
      registeredAt: null,
      cleanedAt: null,
      registerTxHash: null,
      cleanupReason: null,
    };
    getFallbackStore().set(id, record);
    return record;
  }

  const result = await queryPostgres<IpfsUploadRecordRow>(
    `
      insert into ipfs_upload_records (
        address,
        session_id,
        session_version,
        cid,
        file_name,
        file_size,
        status,
        expires_at
      )
      values ($1, $2, $3, $4, $5, $6, 'uploaded', $7)
      returning
        id,
        address,
        session_id,
        session_version,
        cid,
        file_name,
        file_size,
        status,
        uploaded_at,
        expires_at,
        registered_at,
        cleaned_at,
        register_tx_hash,
        cleanup_reason
    `,
    [
      input.address,
      input.sessionId,
      input.sessionVersion,
      input.cid,
      input.fileName,
      input.fileSize,
      input.expiresAt.toISOString(),
    ]
  );

  return normalizeRecord(result.rows[0] as IpfsUploadRecordRow);
}

/**
 * @notice 根据记录 ID 读取上传记录。
 * @param id 上传记录主键。
 * @returns 对应记录；若不存在则返回 `null`。
 */
export async function getIpfsUploadRecordById(id: number) {
  if (!hasPostgresUploadStore()) {
    return getFallbackStore().get(id) ?? null;
  }

  const result = await queryPostgres<IpfsUploadRecordRow>(
    `
      select
        id,
        address,
        session_id,
        session_version,
        cid,
        file_name,
        file_size,
        status,
        uploaded_at,
        expires_at,
        registered_at,
        cleaned_at,
        register_tx_hash,
        cleanup_reason
      from ipfs_upload_records
      where id = $1
      limit 1
    `,
    [id]
  );

  const row = result.rows[0];
  return row ? normalizeRecord(row) : null;
}

/**
 * @notice 把上传记录标记为已完成链上登记。
 * @param id 上传记录主键。
 * @param txHash 对应的链上交易哈希。
 * @returns 更新后的上传记录；若不存在则返回 `null`。
 */
export async function markIpfsUploadRegistered(id: number, txHash?: string | null) {
  if (!hasPostgresUploadStore()) {
    const record = getFallbackStore().get(id);
    if (!record) {
      return null;
    }

    const updated: IpfsUploadRecord = {
      ...record,
      status: "registered",
      registeredAt: record.registeredAt ?? new Date(),
      registerTxHash: txHash ?? record.registerTxHash,
      cleanupReason: null,
    };
    getFallbackStore().set(id, updated);
    return updated;
  }

  const result = await queryPostgres<IpfsUploadRecordRow>(
    `
      update ipfs_upload_records
      set
        status = 'registered',
        registered_at = coalesce(registered_at, now()),
        register_tx_hash = coalesce($2, register_tx_hash),
        cleanup_reason = null
      where id = $1
      returning
        id,
        address,
        session_id,
        session_version,
        cid,
        file_name,
        file_size,
        status,
        uploaded_at,
        expires_at,
        registered_at,
        cleaned_at,
        register_tx_hash,
        cleanup_reason
    `,
    [id, txHash ?? null]
  );

  const row = result.rows[0];
  return row ? normalizeRecord(row) : null;
}

/**
 * @notice 把上传记录标记为已回收。
 * @param id 上传记录主键。
 * @param reason 本次清理原因说明。
 * @returns 更新后的记录；若不存在则返回 `null`。
 */
export async function markIpfsUploadCleaned(id: number, reason: string) {
  if (!hasPostgresUploadStore()) {
    const record = getFallbackStore().get(id);
    if (!record) {
      return null;
    }

    const updated: IpfsUploadRecord = {
      ...record,
      status: "cleaned",
      cleanedAt: new Date(),
      cleanupReason: reason,
    };
    getFallbackStore().set(id, updated);
    return updated;
  }

  const result = await queryPostgres<IpfsUploadRecordRow>(
    `
      update ipfs_upload_records
      set
        status = 'cleaned',
        cleaned_at = now(),
        cleanup_reason = $2
      where id = $1
      returning
        id,
        address,
        session_id,
        session_version,
        cid,
        file_name,
        file_size,
        status,
        uploaded_at,
        expires_at,
        registered_at,
        cleaned_at,
        register_tx_hash,
        cleanup_reason
    `,
    [id, reason]
  );

  const row = result.rows[0];
  return row ? normalizeRecord(row) : null;
}

/**
 * @notice 记录一次孤儿文件清理失败。
 * @param id 上传记录主键。
 * @param reason 失败原因或上下文描述。
 * @returns 更新后的记录；若不存在则返回 `null`。
 */
export async function markIpfsUploadCleanupFailed(id: number, reason: string) {
  if (!hasPostgresUploadStore()) {
    const record = getFallbackStore().get(id);
    if (!record) {
      return null;
    }

    const updated: IpfsUploadRecord = {
      ...record,
      status: "cleanup_failed",
      cleanupReason: reason,
    };
    getFallbackStore().set(id, updated);
    return updated;
  }

  const result = await queryPostgres<IpfsUploadRecordRow>(
    `
      update ipfs_upload_records
      set
        status = 'cleanup_failed',
        cleanup_reason = $2
      where id = $1
      returning
        id,
        address,
        session_id,
        session_version,
        cid,
        file_name,
        file_size,
        status,
        uploaded_at,
        expires_at,
        registered_at,
        cleaned_at,
        register_tx_hash,
        cleanup_reason
    `,
    [id, reason]
  );

  const row = result.rows[0];
  return row ? normalizeRecord(row) : null;
}

/**
 * @notice 查询已经过期且仍需处理的上传记录。
 * @param limit 本次最多返回多少条记录。
 * @returns 已经过期、尚未登记成功的上传记录列表。
 */
export async function listExpiredIpfsUploadRecords(limit: number) {
  if (!hasPostgresUploadStore()) {
    const now = Date.now();
    return Array.from(getFallbackStore().values())
      .filter(
        (record) =>
          (record.status === "uploaded" || record.status === "cleanup_failed") &&
          record.expiresAt.getTime() <= now
      )
      .sort((left, right) => left.expiresAt.getTime() - right.expiresAt.getTime())
      .slice(0, limit);
  }

  const result = await queryPostgres<IpfsUploadRecordRow>(
    `
      select
        id,
        address,
        session_id,
        session_version,
        cid,
        file_name,
        file_size,
        status,
        uploaded_at,
        expires_at,
        registered_at,
        cleaned_at,
        register_tx_hash,
        cleanup_reason
      from ipfs_upload_records
      where
        status in ('uploaded', 'cleanup_failed')
        and expires_at <= now()
      order by expires_at asc, id asc
      limit $1
    `,
    [limit]
  );

  return result.rows.map(normalizeRecord);
}
