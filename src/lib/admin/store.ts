import "server-only";

import { randomUUID } from "node:crypto";

import { getRedis } from "@/lib/redis";
import type {
  AdminRequestStatus,
  AnyAdminRequest,
  NodeJoinRequest,
  NodeJoinRequestInput,
  ValidatorJoinRequest,
  ValidatorJoinRequestInput,
} from "@/lib/admin/types";

const REQUEST_INDEX_LIMIT = 200;

function getIndexKey(kind: AnyAdminRequest["kind"]) {
  return `admin:requests:${kind}:index`;
}

function getItemKey(kind: AnyAdminRequest["kind"], id: string) {
  return `admin:requests:${kind}:${id}`;
}

async function getRequiredAdminRedis() {
  const redis = await getRedis();

  if (!redis) {
    throw new Error("Redis is required for the admin request workflow");
  }

  return redis;
}

async function saveRequest(record: AnyAdminRequest) {
  const redis = await getRequiredAdminRedis();
  const itemKey = getItemKey(record.kind, record.id);
  const indexKey = getIndexKey(record.kind);

  await redis.set(itemKey, JSON.stringify(record));
  await redis.zAdd(indexKey, [{ score: record.createdAt, value: record.id }]);
}

function parseRecord<T extends AnyAdminRequest>(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function createNodeJoinRequest(input: {
  applicantAddress: `0x${string}`;
  payload: NodeJoinRequestInput;
}) {
  const now = Date.now();
  const record: NodeJoinRequest = {
    id: randomUUID(),
    kind: "node",
    applicantAddress: input.applicantAddress,
    nodeName: input.payload.nodeName,
    serverIp: input.payload.serverIp,
    enode: input.payload.enode,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await saveRequest(record);
  return record;
}

export async function createValidatorJoinRequest(input: {
  applicantAddress: `0x${string}`;
  payload: ValidatorJoinRequestInput;
}) {
  const now = Date.now();
  const record: ValidatorJoinRequest = {
    id: randomUUID(),
    kind: "validator",
    applicantAddress: input.applicantAddress,
    nodeName: input.payload.nodeName,
    serverIp: input.payload.serverIp,
    enode: input.payload.enode,
    validatorAddress: input.payload.validatorAddress,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await saveRequest(record);
  return record;
}

export async function listAdminRequests<T extends AnyAdminRequest["kind"]>(
  kind: T,
  options?: {
    applicantAddress?: `0x${string}`;
    status?: AdminRequestStatus;
  }
) {
  const redis = await getRequiredAdminRedis();
  const ids = await redis.zRange(getIndexKey(kind), -REQUEST_INDEX_LIMIT, -1, {
    REV: true,
  });

  if (ids.length === 0) {
    return [] as Extract<AnyAdminRequest, { kind: T }>[];
  }

  const records = await Promise.all(
    ids.map(async (id) =>
      parseRecord<Extract<AnyAdminRequest, { kind: T }>>(
        await redis.get(getItemKey(kind, id))
      )
    )
  );

  const filtered: Extract<AnyAdminRequest, { kind: T }>[] = [];

  for (const record of records) {
    if (!record) {
      continue;
    }

    if (
      options?.applicantAddress &&
      record.applicantAddress.toLowerCase() !==
        options.applicantAddress.toLowerCase()
    ) {
      continue;
    }

    if (options?.status && record.status !== options.status) {
      continue;
    }

    filtered.push(record);
  }

  return filtered;
}

export async function getAdminRequestById<T extends AnyAdminRequest["kind"]>(
  kind: T,
  id: string
) {
  const redis = await getRequiredAdminRedis();
  return parseRecord<Extract<AnyAdminRequest, { kind: T }>>(
    await redis.get(getItemKey(kind, id))
  );
}

export async function reviewAdminRequest<T extends AnyAdminRequest["kind"]>(input: {
  kind: T;
  id: string;
  status: Exclude<AdminRequestStatus, "pending">;
  reviewedBy: `0x${string}` | "system";
  reviewComment?: string;
}) {
  const existing = await getAdminRequestById(input.kind, input.id);

  if (!existing) {
    throw new Error("Request not found");
  }

  const updated: Extract<AnyAdminRequest, { kind: T }> = {
    ...existing,
    status: input.status,
    reviewComment: input.reviewComment?.trim() || undefined,
    reviewedBy: input.reviewedBy,
    reviewedAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveRequest(updated);
  return updated;
}
