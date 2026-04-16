/**
 * @notice Admin 模块共享类型定义。
 * @dev 集中描述节点申请、验证者申请、管理员会话和网络快照等数据结构。
 */
/**
 * @notice 节点申请状态枚举。
 * @dev 表示节点从提交到审批或撤销的完整生命周期状态。
 */
export const NODE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "revoked",
] as const;

/**
 * @notice 验证者申请状态枚举。
 * @dev 表示验证者申请的审批生命周期状态。
 */
export const VALIDATOR_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

/**
 * @notice 节点申请状态类型。
 * @dev 取值范围来自 `NODE_REQUEST_STATUSES`。
 */
export type NodeRequestStatus = (typeof NODE_REQUEST_STATUSES)[number];
/**
 * @notice 验证者申请状态类型。
 * @dev 取值范围来自 `VALIDATOR_REQUEST_STATUSES`。
 */
export type ValidatorRequestStatus = (typeof VALIDATOR_REQUEST_STATUSES)[number];

/**
 * @notice 节点申请记录结构。
 * @dev 保存节点申请基本信息、审批状态和时间戳。
 */
export type NodeRequestRecord = {
  id: string;
  applicantAddress: `0x${string}`;
  nodeName: string;
  serverHost: string;
  nodeRpcUrl: string | null;
  enode: string;
  description: string;
  status: NodeRequestStatus;
  reviewComment: string | null;
  reviewedBy: `0x${string}` | null;
  createTime: string;
  updateTime: string;
};

/**
 * @notice 节点运行时健康阶段。
 * @dev 反映节点在接入与同步过程中的当前健康状态。
 */
export type NodeRuntimeHealthStage =
  | "not_configured"
  | "unreachable"
  | "enode_mismatch"
  | "waiting_for_peers"
  | "syncing"
  | "healthy";

/**
 * @notice 节点申请运行时状态结构。
 * @dev 结合 allowlist 状态与节点健康检查结果展示节点接入进度。
 */
export type NodeRequestRuntimeStatus = {
  requestId: string;
  checkedAt: string;
  isAllowlisted: boolean;
  allowlistError: string | null;
  health: {
    stage: NodeRuntimeHealthStage;
    detail: string;
    peerCount: number | null;
    currentBlock: string | null;
    highestBlock: string | null;
    nodeEnode: string | null;
  };
};

/**
 * @notice 管理员操作日志记录结构。
 * @dev 用于记录审批、撤销和验证者投票等后台动作。
 */
export type AdminActionLogRecord = {
  id: string;
  actorAddress: `0x${string}`;
  action:
    | "node_request_approved"
    | "node_request_rejected"
    | "node_request_revoked"
    | "validator_request_approved"
    | "validator_request_rejected"
    | "validator_removal_vote_proposed";
  targetId: string;
  success: boolean;
  detail: string | null;
  createTime: string;
};

/**
 * @notice 验证者申请记录结构。
 * @dev 保存申请节点、验证者地址和审批信息。
 */
export type ValidatorRequestRecord = {
  id: string;
  applicantAddress: `0x${string}`;
  nodeRequestId: string;
  nodeName: string;
  nodeEnode: string;
  validatorAddress: `0x${string}`;
  description: string;
  status: ValidatorRequestStatus;
  reviewComment: string | null;
  reviewedBy: `0x${string}` | null;
  removalVoteProposedAt: string | null;
  createTime: string;
  updateTime: string;
};

/**
 * @notice 验证者申请列表接口返回结构。
 * @dev 包含请求列表、可用节点、当前验证者和错误信息。
 */
export type ValidatorRequestListResponse = {
  currentAddress: `0x${string}` | null;
  isAdmin: boolean;
  requests: ValidatorRequestRecord[];
  eligibleNodes: NodeRequestRecord[];
  eligibleNodesError: string | null;
  currentValidators: `0x${string}`[];
  validatorsError: string | null;
};

/**
 * @notice 管理员会话返回结构。
 * @dev 描述当前地址是否已登录以及是否具备管理员权限。
 */
export type AdminSessionResponse = {
  authenticated: boolean;
  address: `0x${string}` | null;
  isAdmin: boolean;
};

/**
 * @notice 管理员地址记录结构。
 * @dev 保存管理员钱包、激活状态和备注信息。
 */
export type AdminAddressRecord = {
  id: string;
  walletAddress: `0x${string}`;
  isActive: boolean;
  remark: string | null;
  createdBy: `0x${string}` | null;
  createTime: string;
  updateTime: string;
};

/**
 * @notice 管理员地址列表接口返回结构。
 * @dev 包含当前地址和管理员名单。
 */
export type AdminAddressListResponse = {
  currentAddress: `0x${string}` | null;
  admins: AdminAddressRecord[];
};

/**
 * @notice 节点申请列表接口返回结构。
 * @dev 包含当前地址、管理员标识和节点申请列表。
 */
export type NodeRequestListResponse = {
  currentAddress: `0x${string}` | null;
  isAdmin: boolean;
  requests: NodeRequestRecord[];
};

/**
 * @notice Admin 网络快照结构。
 * @dev 当前主要承载 allowlist 列表及其数量。
 */
export type AdminNetworkSnapshot = {
  allowlist: string[];
  allowlistCount: number;
};
