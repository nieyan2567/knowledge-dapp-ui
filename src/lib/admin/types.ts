export const NODE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export type NodeRequestStatus = (typeof NODE_REQUEST_STATUSES)[number];

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
  action: "node_request_approved" | "node_request_rejected";
  targetId: string;
  success: boolean;
  detail: string | null;
  createTime: string;
};

export type AdminSessionResponse = {
  authenticated: boolean;
  address: `0x${string}` | null;
  isAdmin: boolean;
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
