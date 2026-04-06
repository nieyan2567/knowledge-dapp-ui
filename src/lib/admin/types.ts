export type AdminRequestStatus = "pending" | "approved" | "rejected";

export type AdminReviewMetadata = {
  reviewComment?: string;
  reviewedBy?: `0x${string}` | "system";
  reviewedAt?: number;
};

export type NodeJoinRequest = {
  id: string;
  kind: "node";
  applicantAddress: `0x${string}`;
  nodeName: string;
  serverIp: string;
  enode: string;
  status: AdminRequestStatus;
  createdAt: number;
  updatedAt: number;
} & AdminReviewMetadata;

export type ValidatorJoinRequest = {
  id: string;
  kind: "validator";
  applicantAddress: `0x${string}`;
  nodeName: string;
  serverIp: string;
  enode: string;
  validatorAddress: `0x${string}`;
  status: AdminRequestStatus;
  createdAt: number;
  updatedAt: number;
} & AdminReviewMetadata;

export type AnyAdminRequest = NodeJoinRequest | ValidatorJoinRequest;

export type NodeJoinRequestInput = Pick<
  NodeJoinRequest,
  "nodeName" | "serverIp" | "enode"
>;

export type ValidatorJoinRequestInput = Pick<
  ValidatorJoinRequest,
  "nodeName" | "serverIp" | "enode" | "validatorAddress"
>;
