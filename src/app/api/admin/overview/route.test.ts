/**
 * 模块说明：覆盖管理后台总览接口的聚合与鉴权行为。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createNextRequest } from "@/test/api-route";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { getNodesAllowlist } from "@/lib/besu-admin/permissioning";
import { getValidatorsByBlockNumber } from "@/lib/besu-admin/validators";
import { requireAdminRequest } from "@/server/admin/auth";
import {
  listNodeRequests,
  listRecentAdminActionLogs,
  listValidatorRequests,
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
  requireAdminRequest: vi.fn(),
}));

vi.mock("@/server/admin/store", () => ({
  listNodeRequests: vi.fn(),
  listRecentAdminActionLogs: vi.fn(),
  listValidatorRequests: vi.fn(),
}));

describe("GET /api/admin/overview", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(enforceApiRateLimits).mockResolvedValue({ ok: true });
    vi.mocked(requireAdminRequest).mockResolvedValue({
      ok: true,
      value: { address: "0x1234567890abcdef1234567890abcdef12345678" },
    });
  });

  it("returns computed lifecycle counts for nodes and validators", async () => {
    vi.mocked(listNodeRequests).mockResolvedValue([
      {
        id: "node-1",
        applicantAddress: "0x1234567890abcdef1234567890abcdef12345678",
        nodeName: "Node A",
        serverHost: "node-a",
        nodeRpcUrl: null,
        enode: "enode://node-a",
        description: "",
        status: "pending",
        reviewComment: null,
        reviewedBy: null,
        createTime: "2026-04-09T10:00:00.000Z",
        updateTime: "2026-04-09T10:00:00.000Z",
      },
      {
        id: "node-2",
        applicantAddress: "0x1234567890abcdef1234567890abcdef12345678",
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
      {
        id: "node-3",
        applicantAddress: "0x1234567890abcdef1234567890abcdef12345678",
        nodeName: "Node C",
        serverHost: "node-c",
        nodeRpcUrl: null,
        enode: "enode://node-c",
        description: "",
        status: "revoked",
        reviewComment: null,
        reviewedBy: null,
        createTime: "2026-04-09T12:00:00.000Z",
        updateTime: "2026-04-09T12:00:00.000Z",
      },
    ]);

    vi.mocked(listValidatorRequests).mockResolvedValue([
      {
        id: "validator-1",
        applicantAddress: "0x1234567890abcdef1234567890abcdef12345678",
        nodeRequestId: "node-2",
        nodeName: "Node B",
        nodeEnode: "enode://node-b",
        validatorAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        description: "",
        status: "pending",
        reviewComment: null,
        reviewedBy: null,
        removalVoteProposedAt: null,
        createTime: "2026-04-09T13:00:00.000Z",
        updateTime: "2026-04-09T13:00:00.000Z",
      },
      {
        id: "validator-2",
        applicantAddress: "0x1234567890abcdef1234567890abcdef12345678",
        nodeRequestId: "node-2",
        nodeName: "Node B",
        nodeEnode: "enode://node-b",
        validatorAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        description: "",
        status: "approved",
        reviewComment: null,
        reviewedBy: null,
        removalVoteProposedAt: "2026-04-09T14:00:00.000Z",
        createTime: "2026-04-09T13:10:00.000Z",
        updateTime: "2026-04-09T13:10:00.000Z",
      },
    ]);

    vi.mocked(listRecentAdminActionLogs).mockResolvedValue([
      {
        id: "log-1",
        actorAddress: "0x1234567890abcdef1234567890abcdef12345678",
        action: "validator_removal_vote_proposed",
        targetId: "validator-2",
        success: true,
        detail: null,
        createTime: "2026-04-09T14:00:00.000Z",
      },
    ]);
    vi.mocked(getNodesAllowlist).mockResolvedValue(["enode://node-a", "enode://node-b"]);
    vi.mocked(getValidatorsByBlockNumber).mockResolvedValue([
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);

    const { GET } = await import("@/app/api/admin/overview/route");
    const response = await GET(createNextRequest("http://localhost/api/admin/overview"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      pendingNodeRequestCount: 1,
      approvedNodeRequestCount: 1,
      revokedNodeRequestCount: 1,
      pendingValidatorRequestCount: 1,
      approvedValidatorRequestCount: 1,
      validatorRemovalVoteCount: 1,
      allowlistCount: 2,
      currentValidatorCount: 1,
    });
  });

  it("maps Besu RPC failures to 502", async () => {
    const { BesuAdminRpcError } = await import("@/lib/besu-admin/client");
    vi.mocked(listNodeRequests).mockResolvedValue([]);
    vi.mocked(listValidatorRequests).mockResolvedValue([]);
    vi.mocked(listRecentAdminActionLogs).mockResolvedValue([]);
    vi.mocked(getNodesAllowlist).mockRejectedValue(
      new BesuAdminRpcError("permissioning unavailable")
    );

    const { GET } = await import("@/app/api/admin/overview/route");
    const response = await GET(createNextRequest("http://localhost/api/admin/overview"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Besu 管理概览读取失败：permissioning unavailable",
    });
  });
});
