import "server-only";

import { randomUUID } from "node:crypto";

import { getRedis } from "@/lib/redis";

export type UploadSessionRecord = {
  id: string;
  address: `0x${string}`;
  chainId: number;
  domain: string;
  origin: string;
  userAgentHash: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt: number;
  version: number;
  revokedAt: number | null;
};

type SessionStoreState = {
  records: Map<string, UploadSessionRecord>;
  addressSessions: Map<string, Set<string>>;
  versions: Map<string, number>;
};

declare global {
  var __knowledgeUploadSessionStore: SessionStoreState | undefined;
}

const memoryStore =
  globalThis.__knowledgeUploadSessionStore ?? {
    records: new Map<string, UploadSessionRecord>(),
    addressSessions: new Map<string, Set<string>>(),
    versions: new Map<string, number>(),
  };

if (!globalThis.__knowledgeUploadSessionStore) {
  globalThis.__knowledgeUploadSessionStore = memoryStore;
}

function getSessionKey(sessionId: string) {
  return `upload_session:${sessionId}`;
}

function getAddressSessionsKey(address: `0x${string}`) {
  return `upload_session:address:${address.toLowerCase()}`;
}

function getVersionKey(address: `0x${string}`) {
  return `upload_session:version:${address.toLowerCase()}`;
}

function isExpired(record: UploadSessionRecord, now = Date.now()) {
  return record.expiresAt <= now;
}

function cleanupExpiredMemorySessions(now = Date.now()) {
  for (const record of memoryStore.records.values()) {
    if (isExpired(record, now)) {
      deleteMemorySession(record.id, record.address);
    }
  }
}

function deleteMemorySession(sessionId: string, address: `0x${string}`) {
  memoryStore.records.delete(sessionId);

  const indexKey = address.toLowerCase();
  const sessions = memoryStore.addressSessions.get(indexKey);
  if (!sessions) {
    return;
  }

  sessions.delete(sessionId);
  if (sessions.size === 0) {
    memoryStore.addressSessions.delete(indexKey);
  }
}

async function getAddressVersion(address: `0x${string}`) {
  const redis = await getRedis();

  if (redis) {
    const raw = await redis.get(getVersionKey(address));
    return raw ? Number(raw) || 0 : 0;
  }

  cleanupExpiredMemorySessions();
  return memoryStore.versions.get(address.toLowerCase()) ?? 0;
}

async function bumpAddressVersion(address: `0x${string}`) {
  const redis = await getRedis();

  if (redis) {
    return await redis.incr(getVersionKey(address));
  }

  cleanupExpiredMemorySessions();
  const indexKey = address.toLowerCase();
  const nextVersion = (memoryStore.versions.get(indexKey) ?? 0) + 1;
  memoryStore.versions.set(indexKey, nextVersion);
  return nextVersion;
}

async function deleteRedisSession(sessionId: string, address: `0x${string}`) {
  const redis = await getRedis();

  if (!redis) {
    deleteMemorySession(sessionId, address);
    return;
  }

  await redis.del(getSessionKey(sessionId));
  await redis.sRem(getAddressSessionsKey(address), sessionId);
}

export async function createUploadSessionRecord(input: {
  address: `0x${string}`;
  chainId: number;
  domain: string;
  origin: string;
  userAgentHash: string;
  ttlSeconds: number;
}) {
  const now = Date.now();
  const version = await bumpAddressVersion(input.address);
  await revokeUploadSessionsForAddress(input.address);

  const record: UploadSessionRecord = {
    id: randomUUID(),
    address: input.address,
    chainId: input.chainId,
    domain: input.domain,
    origin: input.origin,
    userAgentHash: input.userAgentHash,
    createdAt: now,
    expiresAt: now + input.ttlSeconds * 1000,
    lastUsedAt: now,
    version,
    revokedAt: null,
  };

  const redis = await getRedis();

  if (redis) {
    await redis.set(getSessionKey(record.id), JSON.stringify(record), {
      EX: input.ttlSeconds,
    });
    await redis.sAdd(getAddressSessionsKey(record.address), record.id);
    await redis.expire(getAddressSessionsKey(record.address), input.ttlSeconds);
    await redis.set(getVersionKey(record.address), String(version), {
      EX: input.ttlSeconds,
    });
    return record;
  }

  cleanupExpiredMemorySessions(now);
  memoryStore.records.set(record.id, record);
  const indexKey = record.address.toLowerCase();
  const sessions = memoryStore.addressSessions.get(indexKey) ?? new Set<string>();
  sessions.add(record.id);
  memoryStore.addressSessions.set(indexKey, sessions);
  memoryStore.versions.set(indexKey, version);
  return record;
}

export async function getUploadSessionRecord(sessionId: string) {
  const redis = await getRedis();

  if (redis) {
    const raw = await redis.get(getSessionKey(sessionId));
    if (!raw) {
      return null;
    }

    try {
      const record = JSON.parse(raw) as UploadSessionRecord;
      if (isExpired(record) || record.revokedAt) {
        await deleteRedisSession(record.id, record.address);
        return null;
      }

      return record;
    } catch {
      return null;
    }
  }

  cleanupExpiredMemorySessions();
  const record = memoryStore.records.get(sessionId);
  if (!record || record.revokedAt || isExpired(record)) {
    if (record) {
      deleteMemorySession(record.id, record.address);
    }
    return null;
  }

  return record;
}

export async function isUploadSessionVersionCurrent(record: UploadSessionRecord) {
  const currentVersion = await getAddressVersion(record.address);
  return currentVersion === 0 || currentVersion === record.version;
}

export async function touchUploadSessionRecord(
  record: UploadSessionRecord,
  ttlSeconds: number
) {
  const updatedRecord: UploadSessionRecord = {
    ...record,
    lastUsedAt: Date.now(),
  };

  const redis = await getRedis();

  if (redis) {
    const ttl = await redis.ttl(getSessionKey(record.id));
    await redis.set(getSessionKey(record.id), JSON.stringify(updatedRecord), {
      EX: ttl > 0 ? ttl : ttlSeconds,
    });
    await redis.expire(getAddressSessionsKey(record.address), ttl > 0 ? ttl : ttlSeconds);
    await redis.expire(getVersionKey(record.address), ttl > 0 ? ttl : ttlSeconds);
    return updatedRecord;
  }

  cleanupExpiredMemorySessions();
  memoryStore.records.set(record.id, updatedRecord);
  return updatedRecord;
}

export async function revokeUploadSession(sessionId: string) {
  const record = await getUploadSessionRecord(sessionId);

  if (!record) {
    return;
  }

  await deleteRedisSession(record.id, record.address);

  const nextVersion = await bumpAddressVersion(record.address);
  const redis = await getRedis();

  if (redis) {
    await redis.set(getVersionKey(record.address), String(nextVersion), {
      EX: Math.max(Math.ceil((record.expiresAt - Date.now()) / 1000), 60),
    });
    return;
  }

  memoryStore.versions.set(record.address.toLowerCase(), nextVersion);
}

export async function revokeUploadSessionsForAddress(address: `0x${string}`) {
  const redis = await getRedis();

  if (redis) {
    const indexKey = getAddressSessionsKey(address);
    const sessionIds = await redis.sMembers(indexKey);
    if (sessionIds.length > 0) {
      await redis.del(sessionIds.map((sessionId) => getSessionKey(sessionId)));
    }
    await redis.del(indexKey);
    return;
  }

  cleanupExpiredMemorySessions();
  const indexKey = address.toLowerCase();
  const sessionIds = memoryStore.addressSessions.get(indexKey);
  if (!sessionIds) {
    return;
  }

  for (const sessionId of sessionIds) {
    memoryStore.records.delete(sessionId);
  }
  memoryStore.addressSessions.delete(indexKey);
}

export function __resetUploadSessionStoreForTests() {
  memoryStore.records.clear();
  memoryStore.addressSessions.clear();
  memoryStore.versions.clear();
}
