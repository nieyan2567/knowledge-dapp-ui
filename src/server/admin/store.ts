/**
 * @file Admin 存储模块。
 * @description 负责管理员后台对节点申请、验证者申请、操作日志和管理员地址的 PostgreSQL 读写。
 */
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

/**
 * @notice 表示管理员存储中的冲突错误。
 * @dev 常用于唯一索引冲突、重复审批或状态不允许的场景。
 */
export class AdminStoreConflictError extends Error {}

/**
 * @notice 表示管理员存储中目标记录不存在。
 */
export class AdminStoreNotFoundError extends Error {}

/**
 * @notice 表示管理员地址存储层当前不可用。
 * @dev 常见于 `admin_address` 表尚未初始化的场景。
 */
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

/**
 * @notice 列出全部节点申请记录。
 * @returns 节点申请记录数组。
 */
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

/**
 * @notice 按申请人地址列出节点申请记录。
 * @param address 申请人钱包地址。
 * @returns 节点申请记录数组。
 */
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

/**
 * @notice 列出已审批通过的节点申请记录。
 * @returns 已通过的节点申请记录数组。
 */
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

/**
 * @notice 按申请人地址列出已通过的节点申请记录。
 * @param address 申请人钱包地址。
 * @returns 已通过的节点申请记录数组。
 */
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

/**
 * @notice 根据标识读取单条节点申请记录。
 * @param id 节点申请标识。
 * @returns 命中的节点申请记录；不存在时返回 `null`。
 */
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

/**
 * @notice 创建新的节点申请记录。
 * @param input 节点申请输入。
 * @returns 新创建的节点申请记录。
 * @throws 当 enode 已存在未完成申请时抛出冲突错误。
 */
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

/**
 * @notice 审批节点申请。
 * @param input 节点审批输入。
 * @returns 更新后的节点申请记录。
 * @throws 当申请不存在或状态不允许审批时抛出异常。
 */
export async function reviewNodeRequest(input: ReviewNodeRequestInput) {
  return withPostgresTransaction(async (client) => {
    const existing = await getNodeRequestByIdForUpdate(client, input.requestId);

    if (!existing) {
      throw new AdminStoreNotFoundError("节点申请不存在");
    }

    if (existing.status !== "pending") {
      throw new AdminStoreConflictError("该申请已经完成审批");
    }

    // 审批和操作日志写入放在同一事务内，确保状态变更与审计记录保持一致。
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

/**
 * @notice 撤销已通过的节点申请。
 * @param input 节点撤销输入。
 * @returns 更新后的节点申请记录。
 * @throws 当申请不存在或状态不是 `approved` 时抛出异常。
 */
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

/**
 * @notice 列出全部验证者申请记录。
 * @returns 验证者申请记录数组。
 */
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

/**
 * @notice 按申请人地址列出验证者申请记录。
 * @param address 申请人钱包地址。
 * @returns 验证者申请记录数组。
 */
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

/**
 * @notice 根据标识读取单条验证者申请记录。
 * @param id 验证者申请标识。
 * @returns 命中的验证者申请记录；不存在时返回 `null`。
 */
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

/**
 * @notice 创建新的验证者申请记录。
 * @param input 验证者申请输入。
 * @returns 新创建的验证者申请记录。
 * @throws 当节点或验证者地址已有未完成申请时抛出冲突错误。
 */
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

/**
 * @notice 审批验证者申请。
 * @param input 验证者审批输入。
 * @returns 更新后的验证者申请记录。
 * @throws 当申请不存在或状态不允许审批时抛出异常。
 */
export async function reviewValidatorRequest(input: ReviewValidatorRequestInput) {
  return withPostgresTransaction(async (client) => {
    const existing = await getValidatorRequestByIdForUpdate(client, input.requestId);

    if (!existing) {
      throw new AdminStoreNotFoundError("Validator 申请不存在");
    }

    if (existing.status !== "pending") {
      throw new AdminStoreConflictError("该 validator 申请已经完成审批");
    }

    // 验证者审批同样与操作日志绑定在同一事务里，避免出现已审批但无审计记录的状态。
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

/**
 * @notice 写入一条管理员操作日志。
 * @param input 管理员操作日志输入。
 * @returns 事务执行结果。
 */
export async function logAdminAction(input: CreateAdminActionLogInput) {
  return withPostgresTransaction(async (client) => {
    await createAdminActionLog(client, input);
  });
}

/**
 * @notice 列出最近的管理员操作日志。
 * @param limit 返回条数上限。
 * @returns 管理员操作日志数组。
 */
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

/**
 * @notice 列出全部管理员地址记录。
 * @returns 管理员地址记录数组。
 * @throws 当 `admin_address` 表不可用时抛出存储不可用错误。
 */
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

/**
 * @notice 创建新的管理员地址记录。
 * @param input 管理员地址输入。
 * @returns 新创建的管理员地址记录。
 * @throws 当管理员表不可用或地址重复时抛出异常。
 */
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

/**
 * @notice 更新管理员地址的启用状态或备注。
 * @param input 管理员地址更新输入。
 * @returns 更新后的管理员地址记录。
 * @throws 当记录不存在、管理员表不可用或会导致没有启用管理员时抛出异常。
 */
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

      // 至少保留一个启用中的管理员，避免后台失去任何可用管理入口。
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

/**
 * @notice 判断当前是否至少存在一个启用中的管理员地址。
 * @returns 若存在启用管理员则返回 `true`。
 * @throws 当管理员表不可用时抛出存储不可用错误。
 */
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

/**
 * @notice 判断指定钱包地址是否为启用中的管理员。
 * @param walletAddress 待检查的钱包地址。
 * @returns 若地址为启用中的管理员则返回 `true`。
 * @throws 当管理员表不可用时抛出存储不可用错误。
 */
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
