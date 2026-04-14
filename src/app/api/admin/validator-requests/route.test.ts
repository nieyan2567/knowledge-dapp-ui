import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJsonRequest, createNextRequest } from "@/test/api-route";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { getNodesAllowlist } from "@/lib/besu-admin/permissioning";
import { getValidatorsByBlockNumber } from "@/lib/besu-admin/validators";
import {
  readAdminRequestContext,
  requireAuthenticatedRequest,
} from "@/server/admin/auth";
import {
  createValidatorRequest,
  getNodeRequestById,
  listApprovedNodeRequests,
  listApprovedNodeRequestsByApplicant,
  listValidatorRequests,
  listValidatorRequestsByApplicant,
} from "@/server/admin/store";

vi.mock("@/lib/api-rate-limit", () => ({
  enforceApiRateLimits: vi.fn(),
}));

vi.mock("@/lib/besu-admin/permissioning", () => ({
  getNodesAllowlist: vi.fn(),
}));

vi.mock("@/lib/besu-admin/validators", () => ({
  getValidatorsByBlockNumber: vi.fn(),
}));

vi.mock("@/server/admin/auth", () => ({
  readAdminRequestContext: vi.fn(),
  requireAuthenticatedRequest: vi.fn(),
}));

vi.mock("@/server/admin/store", () => ({
  createValidatorRequest: vi.fn(),
  getNodeRequestById: vi.fn(),
  listApprovedNodeRequests: vi.fn(),
  listApprovedNodeRequestsByApplicant: vi.fn(),
  listValidatorRequests: vi.fn(),
  listValidatorRequestsByApplicant: vi.fn(),
}));

const address = "0x1234567890abcdef1234567890abcdef12345678";

describe("/api/admin/validator-requests", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(enforceApiRateLimits).mockResolvedValue({ ok: true });
  });

  it("filters eligible nodes to approved nodes that are still in the allowlist", async () => {
    vi.mocked(readAdminRequestContext).mockResolvedValue({
      address,
      isAdmin: false,
    });
    vi.mocked(listValidatorRequestsByApplicant).mockResolvedValue([]);
    vi.mocked(listApprovedNodeRequestsByApplicant).mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        applicantAddress: address,
        nodeName: "Node A",
        serverHost: "node-a",
        nodeRpcUrl: null,
        enode: "enode://node-a",
        description: "",
        status: "approved",
        reviewComment: null,
        reviewedBy: null,
        createTime: "2026-04-09T10:00:00.000Z",
        updateTime: "2026-04-09T10:00:00.000Z",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        applicantAddress: address,
        nodeName: "Node B",
        serverHost: "node-b",
        nodeRpcUrl: null,
        enode: "enode://node-b",
        description: "",
        status: "approved",
        reviewComment: null,
        reviewedBy: null,
        createTime: "2026-04-09T11:00:00.000Z",
        updateTime: "2026-04-09T11:00:00.000Z",
      },
    ]);
    vi.mocked(getNodesAllowlist).mockResolvedValue(["enode://node-b"]);
    vi.mocked(getValidatorsByBlockNumber).mockResolvedValue([
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);

    const { GET } = await import("@/app/api/admin/validator-requests/route");
    const response = await GET(
      createNextRequest("http://localhost/api/admin/validator-requests")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      eligibleNodes: [
        expect.objectContaining({
          id: "22222222-2222-4222-8222-222222222222",
          enode: "enode://node-b",
        }),
      ],
      currentValidators: ["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
    });
  });

  it("rejects validator requests for nodes that are no longer in the allowlist", async () => {
    const nodeRequestId = "11111111-1111-4111-8111-111111111111";

    vi.mocked(requireAuthenticatedRequest).mockResolvedValue({
      ok: true,
      value: { address },
    });
    vi.mocked(getNodeRequestById).mockResolvedValue({
      id: nodeRequestId,
      applicantAddress: address,
      nodeName: "Node A",
      serverHost: "node-a",
      nodeRpcUrl: null,
      enode: "enode://node-a",
      description: "",
      status: "approved",
      reviewComment: null,
      reviewedBy: null,
      createTime: "2026-04-09T10:00:00.000Z",
      updateTime: "2026-04-09T10:00:00.000Z",
    });
    vi.mocked(getNodesAllowlist).mockResolvedValue(["enode://other-node"]);

    const { POST } = await import("@/app/api/admin/validator-requests/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/admin/validator-requests", "POST", {
        nodeRequestId,
        validatorAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        description: "",
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "只有仍在 allowlist 中的普通节点才能提交 Validator 申请",
    });
    expect(createValidatorRequest).not.toHaveBeenCalled();
  });

  it("uses admin listings when the current session is an admin", async () => {
    vi.mocked(readAdminRequestContext).mockResolvedValue({
      address,
      isAdmin: true,
    });
    vi.mocked(listValidatorRequests).mockResolvedValue([]);
    vi.mocked(listApprovedNodeRequests).mockResolvedValue([]);
    vi.mocked(getNodesAllowlist).mockResolvedValue([]);
    vi.mocked(getValidatorsByBlockNumber).mockResolvedValue([]);

    const { GET } = await import("@/app/api/admin/validator-requests/route");
    await GET(createNextRequest("http://localhost/api/admin/validator-requests"));

    expect(listValidatorRequests).toHaveBeenCalledTimes(1);
    expect(listApprovedNodeRequests).toHaveBeenCalledTimes(1);
  });
});
