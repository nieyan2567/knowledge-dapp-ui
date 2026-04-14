import "server-only";

import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import type {
  AdminActionLogRecord,
  AdminAddressRecord,
  NodeRequestRecord,
  NodeRequestStatus,
  ValidatorRequestRecord,
  ValidatorRequestStatus,
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

type RevokeNodeRequestInput = {
  requestId: string;
  reviewedBy: `0x${string}`;
  reviewComment?: string;
};

type CreateValidatorRequestInput = {
  applicantAddress: `0x${string}`;
  nodeRequestId: string;
  validatorAddress: `0x${string}`;
  description: string;
};

type ReviewValidatorRequestInput = {
  requestId: string;
  status: Extract<ValidatorRequestStatus, "approved" | "rejected">;
  reviewedBy: `0x${string}`;
  reviewComment?: string;
};

type CreateAdminActionLogInput = {
  actorAddress: `0x${string}`;
  action: AdminActionLogRecord["action"];
  targetId: string;
  success: boolean;
  detail?: string | null;
};

type CreateAdminAddressInput = {
  walletAddress: `0x${string}`;
  remark?: string;
  createdBy: `0x${string}`;
};

type UpdateAdminAddressInput = {
  id: string;
  isActive?: boolean;
  remark?: string;
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

type ValidatorRequestRow = {
  id: string;
  applicant_address: string;
  node_request_id: string;
  validator_address: string;
  description: string;
  status: ValidatorRequestStatus;
  review_comment: string | null;
  reviewed_by: string | null;
  create_time: Date | string;
  update_time: Date | string;
  node_name: string;
  node_enode: string;
  removal_vote_proposed_at: Date | string | null;
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

type AdminAddressRow = {
  id: string;
  wallet_address: string;
  is_active: boolean;
  remark: string | null;
  created_by: string | null;
  create_time: Date | string;
  update_time: Date | string;
};

type PostgresErrorLike = {
  code?: string;
  constraint?: string;
};

const ACTIVE_NODE_REQUEST_CONSTRAINT = "node_request_enode_active_idx";
const ACTIVE_VALIDATOR_NODE_CONSTRAINT = "validator_request_node_active_idx";
const ACTIVE_VALIDATOR_ADDRESS_CONSTRAINT = "validator_request_address_active_idx";

export class AdminStoreConflictError extends Error {}

export class AdminStoreNotFoundError extends Error {}

export class AdminAddressStoreUnavailableError extends Error {}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isUniqueViolation(error: unknown, constraint?: string) {
  const postgresError = error as PostgresErrorLike;

  return (
    postgresError?.code === "23505" &&
    (!constraint || postgresError.constraint === constraint)
  );
}

function isUndefinedTableError(error: unknown) {
  const postgresError = error as PostgresErrorLike;
  return postgresError?.code === "42P01";
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

function mapValidatorRequestRow(row: ValidatorRequestRow): ValidatorRequestRecord {
  return {
    id: row.id,
    applicantAddress: row.applicant_address as `0x${string}`,
    nodeRequestId: row.node_request_id,
    nodeName: row.node_name,
    nodeEnode: row.node_enode,
    validatorAddress: row.validator_address as `0x${string}`,
    description: row.description,
    status: row.status,
    reviewComment: row.review_comment,
    reviewedBy: row.reviewed_by as `0x${string}` | null,
    removalVoteProposedAt: row.removal_vote_proposed_at
      ? toIsoString(row.removal_vote_proposed_at)
      : null,
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

function mapAdminAddressRow(row: AdminAddressRow): AdminAddressRecord {
  return {
    id: row.id,
    walletAddress: row.wallet_address as `0x${string}`,
    isActive: row.is_active,
    remark: row.remark,
    createdBy: row.created_by as `0x${string}` | null,
    createTime: toIsoString(row.create_time),
    updateTime: toIsoString(row.update_time),
  };
}

async function createAdminActionLog(
  client: PoolClient,
  input: CreateAdminActionLogInput
) {
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
      input.actorAddress,
      input.action,
      input.targetId,
      input.success,
      input.detail ?? null,
    ]
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

async function getValidatorRequestByIdForUpdate(client: PoolClient, id: string) {
  const result = await client.query<ValidatorRequestRow>(
    `
      select
        vr.id,
        vr.applicant_address,
        vr.node_request_id,
        vr.validator_address,
        vr.description,
        vr.status,
        vr.review_comment,
        vr.reviewed_by,
        vr.create_time,
        vr.update_time,
        nr.node_name,
        nr.enode as node_enode,
        (
          select max(aal.create_time)
          from admin_action_log aal
          where aal.target_id = vr.id
            and aal.action = 'validator_removal_vote_proposed'
        ) as removal_vote_proposed_at
      from validator_request vr
      join node_request nr on nr.id = vr.node_request_id
      where vr.id = $1
      for update of vr
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

export async function listApprovedNodeRequests() {
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
      where status = 'approved'
      order by create_time desc
    `
  );

  return result.rows.map(mapNodeRequestRow);
}

export async function listApprovedNodeRequestsByApplicant(address: `0x${string}`) {
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
      where status = 'approved'
        and lower(applicant_address) = lower($1)
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
      throw new AdminStoreConflictError("该 enode 已存在未完成的申请记录");
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
      throw new AdminStoreConflictError("该申请已经完成审批");
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

    await createAdminActionLog(client, {
      actorAddress: input.reviewedBy,
      action:
        input.status === "approved"
          ? "node_request_approved"
          : "node_request_rejected",
      targetId: input.requestId,
      success: true,
      detail: updatedRequest.reviewComment,
    });

    return updatedRequest;
  });
}

export async function revokeNodeRequest(input: RevokeNodeRequestInput) {
  return withPostgresTransaction(async (client) => {
    const existing = await getNodeRequestByIdForUpdate(client, input.requestId);

    if (!existing) {
      throw new AdminStoreNotFoundError("节点申请不存在");
    }

    if (existing.status !== "approved") {
      throw new AdminStoreConflictError("只有已批准的节点申请才能撤销");
    }

    const updatedResult = await client.query<NodeRequestRow>(
      `
        update node_request
        set
          status = 'revoked',
          reviewed_by = $2,
          review_comment = $3,
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
      [input.requestId, input.reviewedBy, input.reviewComment?.trim() || null]
    );

    const updatedRequest = mapNodeRequestRow(queryRequiredRow(updatedResult));

    await createAdminActionLog(client, {
      actorAddress: input.reviewedBy,
      action: "node_request_revoked",
      targetId: input.requestId,
      success: true,
      detail: updatedRequest.reviewComment,
    });

    return updatedRequest;
  });
}

export async function listValidatorRequests() {
  const result = await queryPostgres<ValidatorRequestRow>(
    `
      select
        vr.id,
        vr.applicant_address,
        vr.node_request_id,
        vr.validator_address,
        vr.description,
        vr.status,
        vr.review_comment,
        vr.reviewed_by,
        vr.create_time,
        vr.update_time,
        nr.node_name,
        nr.enode as node_enode,
        (
          select max(aal.create_time)
          from admin_action_log aal
          where aal.target_id = vr.id
            and aal.action = 'validator_removal_vote_proposed'
        ) as removal_vote_proposed_at
      from validator_request vr
      join node_request nr on nr.id = vr.node_request_id
      order by vr.create_time desc
    `
  );

  return result.rows.map(mapValidatorRequestRow);
}

export async function listValidatorRequestsByApplicant(address: `0x${string}`) {
  const result = await queryPostgres<ValidatorRequestRow>(
    `
      select
        vr.id,
        vr.applicant_address,
        vr.node_request_id,
        vr.validator_address,
        vr.description,
        vr.status,
        vr.review_comment,
        vr.reviewed_by,
        vr.create_time,
        vr.update_time,
        nr.node_name,
        nr.enode as node_enode,
        (
          select max(aal.create_time)
          from admin_action_log aal
          where aal.target_id = vr.id
            and aal.action = 'validator_removal_vote_proposed'
        ) as removal_vote_proposed_at
      from validator_request vr
      join node_request nr on nr.id = vr.node_request_id
      where lower(vr.applicant_address) = lower($1)
      order by vr.create_time desc
    `,
    [address]
  );

  return result.rows.map(mapValidatorRequestRow);
}

export async function getValidatorRequestById(id: string) {
  const result = await queryPostgres<ValidatorRequestRow>(
    `
      select
        vr.id,
        vr.applicant_address,
        vr.node_request_id,
        vr.validator_address,
        vr.description,
        vr.status,
        vr.review_comment,
        vr.reviewed_by,
        vr.create_time,
        vr.update_time,
        nr.node_name,
        nr.enode as node_enode
      from validator_request vr
      join node_request nr on nr.id = vr.node_request_id
      where vr.id = $1
      limit 1
    `,
    [id]
  );

  const row = result.rows[0];
  return row ? mapValidatorRequestRow(row) : null;
}

export async function createValidatorRequest(input: CreateValidatorRequestInput) {
  try {
    const result = await queryPostgres<ValidatorRequestRow>(
      `
        insert into validator_request (
          id,
          applicant_address,
          node_request_id,
          validator_address,
          description,
          status,
          create_time,
          update_time
        )
        values ($1, $2, $3, $4, $5, 'pending', now(), now())
        returning
          id,
          applicant_address,
          node_request_id,
          validator_address,
          description,
          status,
          review_comment,
          reviewed_by,
          create_time,
          update_time,
          (
            select node_name
            from node_request
            where id = $3
          ) as node_name,
          (
            select enode
            from node_request
            where id = $3
          ) as node_enode,
          null::timestamptz as removal_vote_proposed_at
      `,
      [
        randomUUID(),
        input.applicantAddress,
        input.nodeRequestId,
        input.validatorAddress,
        input.description,
      ]
    );

    return mapValidatorRequestRow(queryRequiredRow(result));
  } catch (error) {
    if (
      isUniqueViolation(error, ACTIVE_VALIDATOR_NODE_CONSTRAINT) ||
      isUniqueViolation(error, ACTIVE_VALIDATOR_ADDRESS_CONSTRAINT)
    ) {
      throw new AdminStoreConflictError("该节点或 validator 地址已存在未完成的申请记录");
    }

    throw error;
  }
}

export async function reviewValidatorRequest(input: ReviewValidatorRequestInput) {
  return withPostgresTransaction(async (client) => {
    const existing = await getValidatorRequestByIdForUpdate(client, input.requestId);

    if (!existing) {
      throw new AdminStoreNotFoundError("Validator 申请不存在");
    }

    if (existing.status !== "pending") {
      throw new AdminStoreConflictError("该 validator 申请已经完成审批");
    }

    const updatedResult = await client.query<ValidatorRequestRow>(
      `
        update validator_request vr
        set
          status = $2,
          reviewed_by = $3,
          review_comment = $4,
          update_time = now()
        where vr.id = $1
        returning
          vr.id,
          vr.applicant_address,
          vr.node_request_id,
          vr.validator_address,
          vr.description,
          vr.status,
          vr.review_comment,
          vr.reviewed_by,
          vr.create_time,
          vr.update_time,
          (
            select node_name
            from node_request
            where id = vr.node_request_id
          ) as node_name,
          (
            select enode
            from node_request
            where id = vr.node_request_id
          ) as node_enode,
          (
            select max(aal.create_time)
            from admin_action_log aal
            where aal.target_id = vr.id
              and aal.action = 'validator_removal_vote_proposed'
          ) as removal_vote_proposed_at
      `,
      [
        input.requestId,
        input.status,
        input.reviewedBy,
        input.reviewComment?.trim() || null,
      ]
    );

    const updatedRequest = mapValidatorRequestRow(queryRequiredRow(updatedResult));

    await createAdminActionLog(client, {
      actorAddress: input.reviewedBy,
      action:
        input.status === "approved"
          ? "validator_request_approved"
          : "validator_request_rejected",
      targetId: input.requestId,
      success: true,
      detail: updatedRequest.reviewComment,
    });

    return updatedRequest;
  });
}

export async function logAdminAction(input: CreateAdminActionLogInput) {
  return withPostgresTransaction(async (client) => {
    await createAdminActionLog(client, input);
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

export async function listAdminAddresses() {
  try {
    const result = await queryPostgres<AdminAddressRow>(
      `
        select
          id,
          wallet_address,
          is_active,
          remark,
          created_by,
          create_time,
          update_time
        from admin_address
        order by is_active desc, create_time asc
      `
    );

    return result.rows.map(mapAdminAddressRow);
  } catch (error) {
    if (isUndefinedTableError(error)) {
      throw new AdminAddressStoreUnavailableError(
        "admin_address table is not available"
      );
    }

    throw error;
  }
}

export async function createAdminAddress(input: CreateAdminAddressInput) {
  try {
    const result = await queryPostgres<AdminAddressRow>(
      `
        insert into admin_address (
          id,
          wallet_address,
          is_active,
          remark,
          created_by,
          create_time,
          update_time
        )
        values ($1, $2, true, $3, $4, now(), now())
        returning
          id,
          wallet_address,
          is_active,
          remark,
          created_by,
          create_time,
          update_time
      `,
      [
        randomUUID(),
        input.walletAddress,
        input.remark?.trim() || null,
        input.createdBy,
      ]
    );

    return mapAdminAddressRow(queryRequiredRow(result));
  } catch (error) {
    if (isUndefinedTableError(error)) {
      throw new AdminAddressStoreUnavailableError(
        "admin_address table is not available"
      );
    }

    if (isUniqueViolation(error)) {
      throw new AdminStoreConflictError("该管理员钱包地址已存在");
    }

    throw error;
  }
}

export async function updateAdminAddress(input: UpdateAdminAddressInput) {
  try {
    return await withPostgresTransaction(async (client) => {
      const existingResult = await client.query<AdminAddressRow>(
        `
          select
            id,
            wallet_address,
            is_active,
            remark,
            created_by,
            create_time,
            update_time
          from admin_address
          where id = $1
          for update
        `,
        [input.id]
      );

      const existing = existingResult.rows[0];
      if (!existing) {
        throw new AdminStoreNotFoundError("管理员地址不存在");
      }

      const nextIsActive = input.isActive ?? existing.is_active;
      const nextRemark =
        input.remark !== undefined ? input.remark.trim() || null : existing.remark;

      if (existing.is_active && !nextIsActive) {
        const activeCountResult = await client.query<{ count: string }>(
          `
            select count(*)::text as count
            from admin_address
            where is_active = true
          `
        );

        if (Number(activeCountResult.rows[0]?.count ?? "0") <= 1) {
          throw new AdminStoreConflictError("至少需要保留一个启用中的管理员");
        }
      }

      const updatedResult = await client.query<AdminAddressRow>(
        `
          update admin_address
          set
            is_active = $2,
            remark = $3,
            update_time = now()
          where id = $1
          returning
            id,
            wallet_address,
            is_active,
            remark,
            created_by,
            create_time,
            update_time
        `,
        [input.id, nextIsActive, nextRemark]
      );

      return mapAdminAddressRow(queryRequiredRow(updatedResult));
    });
  } catch (error) {
    if (isUndefinedTableError(error)) {
      throw new AdminAddressStoreUnavailableError(
        "admin_address table is not available"
      );
    }

    throw error;
  }
}

export async function hasAnyAdminAddresses() {
  try {
    const result = await queryPostgres<{ count: string }>(
      `
        select count(*)::text as count
        from admin_address
        where is_active = true
      `
    );

    return Number(result.rows[0]?.count ?? "0") > 0;
  } catch (error) {
    if (isUndefinedTableError(error)) {
      throw new AdminAddressStoreUnavailableError(
        "admin_address table is not available"
      );
    }

    throw error;
  }
}

export async function isAdminAddress(walletAddress: `0x${string}`) {
  try {
    const result = await queryPostgres<AdminAddressRow>(
      `
        select
          id,
          wallet_address,
          is_active,
          remark,
          created_by,
          create_time,
          update_time
        from admin_address
        where lower(wallet_address) = lower($1)
          and is_active = true
        limit 1
      `,
      [walletAddress]
    );

    return result.rows.length > 0;
  } catch (error) {
    if (isUndefinedTableError(error)) {
      throw new AdminAddressStoreUnavailableError(
        "admin_address table is not available"
      );
    }

    throw error;
  }
}
