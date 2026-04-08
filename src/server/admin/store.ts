import "server-only";

import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import type {
  AdminActionLogRecord,
  NodeRequestRecord,
  NodeRequestStatus,
} from "@/lib/admin/types";
import {
  queryPostgres,
  queryRequiredRow,
  withPostgresTransaction,
} from "@/server/db/postgres";

type CreateNodeRequestInput = {
  applicantAddress: `0x${string}`;
  nodeName: string;
  serverHost: string;
  nodeRpcUrl: string;
  enode: string;
  description: string;
};

type ReviewNodeRequestInput = {
  requestId: string;
  status: Extract<NodeRequestStatus, "approved" | "rejected">;
  reviewedBy: `0x${string}`;
  reviewComment?: string;
};

type NodeRequestRow = {
  id: string;
  applicant_address: string;
  node_name: string;
  server_host: string;
  node_rpc_url: string | null;
  enode: string;
  description: string;
  status: NodeRequestStatus;
  review_comment: string | null;
  reviewed_by: string | null;
  create_time: Date | string;
  update_time: Date | string;
};

type AdminActionLogRow = {
  id: string;
  actor_address: string;
  action: AdminActionLogRecord["action"];
  target_id: string;
  success: boolean;
  detail: string | null;
  create_time: Date | string;
};

type PostgresErrorLike = {
  code?: string;
  constraint?: string;
};

const ACTIVE_NODE_REQUEST_CONSTRAINT = "node_request_enode_active_idx";

export class AdminStoreConflictError extends Error {}

export class AdminStoreNotFoundError extends Error {}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapNodeRequestRow(row: NodeRequestRow): NodeRequestRecord {
  return {
    id: row.id,
    applicantAddress: row.applicant_address as `0x${string}`,
    nodeName: row.node_name,
    serverHost: row.server_host,
    nodeRpcUrl: row.node_rpc_url,
    enode: row.enode,
    description: row.description,
    status: row.status,
    reviewComment: row.review_comment,
    reviewedBy: row.reviewed_by as `0x${string}` | null,
    createTime: toIsoString(row.create_time),
    updateTime: toIsoString(row.update_time),
  };
}

function mapAdminActionLogRow(row: AdminActionLogRow): AdminActionLogRecord {
  return {
    id: row.id,
    actorAddress: row.actor_address as `0x${string}`,
    action: row.action,
    targetId: row.target_id,
    success: row.success,
    detail: row.detail,
    createTime: toIsoString(row.create_time),
  };
}

function isUniqueViolation(error: unknown, constraint?: string) {
  const postgresError = error as PostgresErrorLike;

  return (
    postgresError?.code === "23505" &&
    (!constraint || postgresError.constraint === constraint)
  );
}

async function getNodeRequestByIdForUpdate(client: PoolClient, id: string) {
  const result = await client.query<NodeRequestRow>(
    `
      select
        id,
        applicant_address,
        node_name,
        server_host,
        node_rpc_url,
        enode,
        description,
        status,
        review_comment,
        reviewed_by,
        create_time,
        update_time
      from node_request
      where id = $1
      for update
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function listNodeRequests() {
  const result = await queryPostgres<NodeRequestRow>(
    `
      select
        id,
        applicant_address,
        node_name,
        server_host,
        node_rpc_url,
        enode,
        description,
        status,
        review_comment,
        reviewed_by,
        create_time,
        update_time
      from node_request
      order by create_time desc
    `
  );

  return result.rows.map(mapNodeRequestRow);
}

export async function listNodeRequestsByApplicant(address: `0x${string}`) {
  const result = await queryPostgres<NodeRequestRow>(
    `
      select
        id,
        applicant_address,
        node_name,
        server_host,
        node_rpc_url,
        enode,
        description,
        status,
        review_comment,
        reviewed_by,
        create_time,
        update_time
      from node_request
      where lower(applicant_address) = lower($1)
      order by create_time desc
    `,
    [address]
  );

  return result.rows.map(mapNodeRequestRow);
}

export async function getNodeRequestById(id: string) {
  const result = await queryPostgres<NodeRequestRow>(
    `
      select
        id,
        applicant_address,
        node_name,
        server_host,
        node_rpc_url,
        enode,
        description,
        status,
        review_comment,
        reviewed_by,
        create_time,
        update_time
      from node_request
      where id = $1
      limit 1
    `,
    [id]
  );

  const row = result.rows[0];
  return row ? mapNodeRequestRow(row) : null;
}

export async function createNodeRequest(input: CreateNodeRequestInput) {
  try {
    const result = await queryPostgres<NodeRequestRow>(
      `
        insert into node_request (
          id,
          applicant_address,
          node_name,
          server_host,
          node_rpc_url,
          enode,
          description,
          status,
          create_time,
          update_time
        )
        values ($1, $2, $3, $4, $5, $6, $7, 'pending', now(), now())
        returning
          id,
          applicant_address,
          node_name,
          server_host,
          node_rpc_url,
          enode,
          description,
          status,
          review_comment,
          reviewed_by,
          create_time,
          update_time
      `,
      [
        randomUUID(),
        input.applicantAddress,
        input.nodeName,
        input.serverHost,
        input.nodeRpcUrl || null,
        input.enode,
        input.description,
      ]
    );

    return mapNodeRequestRow(queryRequiredRow(result));
  } catch (error) {
    if (isUniqueViolation(error, ACTIVE_NODE_REQUEST_CONSTRAINT)) {
      throw new AdminStoreConflictError(
        "该 enode 已存在未完成的申请记录"
      );
    }

    throw error;
  }
}

export async function reviewNodeRequest(input: ReviewNodeRequestInput) {
  return withPostgresTransaction(async (client) => {
    const existing = await getNodeRequestByIdForUpdate(client, input.requestId);

    if (!existing) {
      throw new AdminStoreNotFoundError("节点申请不存在");
    }

    if (existing.status !== "pending") {
      throw new AdminStoreConflictError(
        "该申请已经完成审批"
      );
    }

    const updatedResult = await client.query<NodeRequestRow>(
      `
        update node_request
        set
          status = $2,
          reviewed_by = $3,
          review_comment = $4,
          update_time = now()
        where id = $1
        returning
          id,
          applicant_address,
          node_name,
          server_host,
          node_rpc_url,
          enode,
          description,
          status,
          review_comment,
          reviewed_by,
          create_time,
          update_time
      `,
      [
        input.requestId,
        input.status,
        input.reviewedBy,
        input.reviewComment?.trim() || null,
      ]
    );

    const updatedRequest = mapNodeRequestRow(queryRequiredRow(updatedResult));

    await client.query(
      `
        insert into admin_action_log (
          id,
          actor_address,
          action,
          target_id,
          success,
          detail,
          create_time
        )
        values ($1, $2, $3, $4, $5, $6, now())
      `,
      [
        randomUUID(),
        input.reviewedBy,
        input.status === "approved"
          ? "node_request_approved"
          : "node_request_rejected",
        input.requestId,
        true,
        updatedRequest.reviewComment,
      ]
    );

    return updatedRequest;
  });
}

export async function listRecentAdminActionLogs(limit = 10) {
  const result = await queryPostgres<AdminActionLogRow>(
    `
      select
        id,
        actor_address,
        action,
        target_id,
        success,
        detail,
        create_time
      from admin_action_log
      order by create_time desc
      limit $1
    `,
    [limit]
  );

  return result.rows.map(mapAdminActionLogRow);
}
