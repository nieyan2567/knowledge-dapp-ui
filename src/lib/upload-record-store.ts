/**
 * @file IPFS 上传记录存储模块。
 * @description 负责记录上传文件、绑定链上内容版本、维护软删除宽限期，以及在清理后更新状态。
 */
import "server-only";

import { getServerEnv } from "@/lib/env";
import { queryPostgres } from "@/server/db/postgres";

export type IpfsUploadRecordStatus =
  | "uploaded"
  | "registered"
  | "cleaned"
  | "cleanup_failed";

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
  contentId: bigint | null;
  versionNumber: bigint | null;
  softDeletedAt: Date | null;
  deletionScheduledAt: Date | null;
  purgedAt: Date | null;
};

export type CreateIpfsUploadRecordInput = {
  address: string;
  sessionId: string;
  sessionVersion: number;
  cid: string;
  fileName: string;
  fileSize: number;
  expiresAt: Date;
};

type MarkRegisteredInput = {
  txHash?: string | null;
  contentId?: bigint | null;
  versionNumber?: bigint | null;
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
  content_id: string | number | null;
  version_number: string | number | null;
  soft_deleted_at: Date | string | null;
  deletion_scheduled_at: Date | string | null;
  purged_at: Date | string | null;
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

function normalizeBigInt(value: string | number | null) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  return BigInt(value);
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
    contentId: normalizeBigInt(row.content_id),
    versionNumber: normalizeBigInt(row.version_number),
    softDeletedAt: normalizeDate(row.soft_deleted_at),
    deletionScheduledAt: normalizeDate(row.deletion_scheduled_at),
    purgedAt: normalizeDate(row.purged_at),
  };
}

function cloneRecord(record: IpfsUploadRecord): IpfsUploadRecord {
  return {
    ...record,
    uploadedAt: new Date(record.uploadedAt),
    expiresAt: new Date(record.expiresAt),
    registeredAt: record.registeredAt ? new Date(record.registeredAt) : null,
    cleanedAt: record.cleanedAt ? new Date(record.cleanedAt) : null,
    softDeletedAt: record.softDeletedAt ? new Date(record.softDeletedAt) : null,
    deletionScheduledAt: record.deletionScheduledAt
      ? new Date(record.deletionScheduledAt)
      : null,
    purgedAt: record.purgedAt ? new Date(record.purgedAt) : null,
  };
}

async function queryRecordById(id: number) {
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
        cleanup_reason,
        content_id,
        version_number,
        soft_deleted_at,
        deletion_scheduled_at,
        purged_at
      from ipfs_upload_records
      where id = $1
      limit 1
    `,
    [id]
  );

  const row = result.rows[0];
  return row ? normalizeRecord(row) : null;
}

export async function createIpfsUploadRecord(input: CreateIpfsUploadRecordInput) {
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
      contentId: null,
      versionNumber: null,
      softDeletedAt: null,
      deletionScheduledAt: null,
      purgedAt: null,
    };
    getFallbackStore().set(id, record);
    return cloneRecord(record);
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
        cleanup_reason,
        content_id,
        version_number,
        soft_deleted_at,
        deletion_scheduled_at,
        purged_at
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

export async function getIpfsUploadRecordById(id: number) {
  if (!hasPostgresUploadStore()) {
    const record = getFallbackStore().get(id);
    return record ? cloneRecord(record) : null;
  }

  return queryRecordById(id);
}

export async function markIpfsUploadRegistered(
  id: number,
  input: MarkRegisteredInput = {}
) {
  if (!hasPostgresUploadStore()) {
    const record = getFallbackStore().get(id);
    if (!record) {
      return null;
    }

    const updated: IpfsUploadRecord = {
      ...record,
      status: "registered",
      registeredAt: record.registeredAt ?? new Date(),
      registerTxHash: input.txHash ?? record.registerTxHash,
      cleanupReason: null,
      contentId: input.contentId ?? record.contentId,
      versionNumber: input.versionNumber ?? record.versionNumber,
      softDeletedAt: null,
      deletionScheduledAt: null,
    };
    getFallbackStore().set(id, updated);
    return cloneRecord(updated);
  }

  await queryPostgres(
    `
      update ipfs_upload_records
      set
        status = 'registered',
        registered_at = coalesce(registered_at, now()),
        register_tx_hash = coalesce($2, register_tx_hash),
        cleanup_reason = null,
        content_id = coalesce($3, content_id),
        version_number = coalesce($4, version_number),
        soft_deleted_at = null,
        deletion_scheduled_at = null
      where id = $1
    `,
    [
      id,
      input.txHash ?? null,
      input.contentId?.toString() ?? null,
      input.versionNumber?.toString() ?? null,
    ]
  );

  return queryRecordById(id);
}

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
      purgedAt: new Date(),
    };
    getFallbackStore().set(id, updated);
    return cloneRecord(updated);
  }

  await queryPostgres(
    `
      update ipfs_upload_records
      set
        status = 'cleaned',
        cleaned_at = now(),
        cleanup_reason = $2,
        purged_at = now()
      where id = $1
    `,
    [id, reason]
  );

  return queryRecordById(id);
}

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
    return cloneRecord(updated);
  }

  await queryPostgres(
    `
      update ipfs_upload_records
      set
        status = 'cleanup_failed',
        cleanup_reason = $2
      where id = $1
    `,
    [id, reason]
  );

  return queryRecordById(id);
}

export async function listExpiredIpfsUploadRecords(limit: number) {
  if (!hasPostgresUploadStore()) {
    const now = Date.now();
    return Array.from(getFallbackStore().values())
      .filter(
        (record) =>
          record.contentId === null &&
          (record.status === "uploaded" || record.status === "cleanup_failed") &&
          record.expiresAt.getTime() <= now
      )
      .sort((left, right) => left.expiresAt.getTime() - right.expiresAt.getTime())
      .slice(0, limit)
      .map(cloneRecord);
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
        cleanup_reason,
        content_id,
        version_number,
        soft_deleted_at,
        deletion_scheduled_at,
        purged_at
      from ipfs_upload_records
      where
        content_id is null
        and status in ('uploaded', 'cleanup_failed')
        and expires_at <= now()
      order by expires_at asc, id asc
      limit $1
    `,
    [limit]
  );

  return result.rows.map(normalizeRecord);
}

export async function scheduleSoftDeleteForContent(
  contentId: bigint,
  scheduledAt: Date,
  deletedAt = new Date()
) {
  if (!hasPostgresUploadStore()) {
    const store = getFallbackStore();
    for (const [id, record] of store.entries()) {
      if (record.contentId === contentId && record.purgedAt === null) {
        store.set(id, {
          ...record,
          softDeletedAt: deletedAt,
          deletionScheduledAt: scheduledAt,
        });
      }
    }

    return;
  }

  await queryPostgres(
    `
      update ipfs_upload_records
      set
        soft_deleted_at = $2,
        deletion_scheduled_at = $3
      where
        content_id = $1
        and purged_at is null
    `,
    [contentId.toString(), deletedAt.toISOString(), scheduledAt.toISOString()]
  );
}

export async function cancelSoftDeleteForContent(contentId: bigint) {
  if (!hasPostgresUploadStore()) {
    const store = getFallbackStore();
    for (const [id, record] of store.entries()) {
      if (record.contentId === contentId && record.purgedAt === null) {
        store.set(id, {
          ...record,
          softDeletedAt: null,
          deletionScheduledAt: null,
        });
      }
    }

    return;
  }

  await queryPostgres(
    `
      update ipfs_upload_records
      set
        soft_deleted_at = null,
        deletion_scheduled_at = null
      where
        content_id = $1
        and purged_at is null
    `,
    [contentId.toString()]
  );
}

export async function listDueSoftDeletedContentIds(limit: number) {
  if (!hasPostgresUploadStore()) {
    const now = Date.now();
    const ids = new Set<string>();

    for (const record of getFallbackStore().values()) {
      if (
        record.contentId !== null &&
        record.deletionScheduledAt &&
        record.deletionScheduledAt.getTime() <= now &&
        record.purgedAt === null
      ) {
        ids.add(record.contentId.toString());
      }
    }

    return Array.from(ids)
      .slice(0, limit)
      .map((value) => BigInt(value));
  }

  const result = await queryPostgres<{ content_id: string }>(
    `
      select distinct content_id
      from ipfs_upload_records
      where
        content_id is not null
        and deletion_scheduled_at is not null
        and deletion_scheduled_at <= now()
        and purged_at is null
      order by content_id asc
      limit $1
    `,
    [limit]
  );

  return result.rows.map((row) => BigInt(row.content_id));
}

export async function listIpfsUploadRecordsByContentId(contentId: bigint) {
  if (!hasPostgresUploadStore()) {
    return Array.from(getFallbackStore().values())
      .filter((record) => record.contentId === contentId)
      .sort((left, right) => Number((left.versionNumber ?? 0n) - (right.versionNumber ?? 0n)))
      .map(cloneRecord);
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
        cleanup_reason,
        content_id,
        version_number,
        soft_deleted_at,
        deletion_scheduled_at,
        purged_at
      from ipfs_upload_records
      where content_id = $1
      order by version_number asc nulls last, id asc
    `,
    [contentId.toString()]
  );

  return result.rows.map(normalizeRecord);
}

export async function getContentStorageLifecycleSummary(contentId: bigint) {
  const records = await listIpfsUploadRecordsByContentId(contentId);

  if (records.length === 0) {
    return null;
  }

  const scheduledAt = records
    .map((item) => item.deletionScheduledAt)
    .find((item) => !!item) ?? null;
  const purgedCount = records.filter((item) => item.purgedAt).length;

  return {
    contentId,
    totalRecords: records.length,
    purgedCount,
    hasPendingPurge: !!scheduledAt,
    scheduledAt,
    fullyPurged: purgedCount === records.length,
  };
}
