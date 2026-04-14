export const NODE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "revoked",
] as const;

export const VALIDATOR_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export type NodeRequestStatus = (typeof NODE_REQUEST_STATUSES)[number];
export type ValidatorRequestStatus = (typeof VALIDATOR_REQUEST_STATUSES)[number];

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

export type NodeRuntimeHealthStage =
  | "not_configured"
  | "unreachable"
  | "enode_mismatch"
  | "waiting_for_peers"
  | "syncing"
  | "healthy";

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

export type ValidatorRequestListResponse = {
  currentAddress: `0x${string}` | null;
  isAdmin: boolean;
  requests: ValidatorRequestRecord[];
  eligibleNodes: NodeRequestRecord[];
  eligibleNodesError: string | null;
  currentValidators: `0x${string}`[];
  validatorsError: string | null;
};

export type AdminSessionResponse = {
  authenticated: boolean;
  address: `0x${string}` | null;
  isAdmin: boolean;
};

export type AdminAddressRecord = {
  id: string;
  walletAddress: `0x${string}`;
  isActive: boolean;
  remark: string | null;
  createdBy: `0x${string}` | null;
  createTime: string;
  updateTime: string;
};

export type AdminAddressListResponse = {
  currentAddress: `0x${string}` | null;
  admins: AdminAddressRecord[];
};

export type NodeRequestListResponse = {
  currentAddress: `0x${string}` | null;
  isAdmin: boolean;
  requests: NodeRequestRecord[];
};

export type AdminNetworkSnapshot = {
  allowlist: string[];
  allowlistCount: number;
};
