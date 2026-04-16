/**
 * 模块说明：覆盖管理员地址列表与创建接口行为。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";

import { createJsonRequest, createNextRequest } from "@/test/api-route";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { requireAdminRequest } from "@/server/admin/auth";
import {
  AdminAddressStoreUnavailableError,
  AdminStoreConflictError,
  createAdminAddress,
  listAdminAddresses,
  updateAdminAddress,
} from "@/server/admin/store";

vi.mock("@/lib/api-rate-limit", () => ({
  enforceApiRateLimits: vi.fn(),
}));

vi.mock("@/server/admin/auth", () => ({
  requireAdminRequest: vi.fn(),
}));

vi.mock("@/lib/observability/server", () => ({
  captureServerException: vi.fn(),
}));

vi.mock("@/server/admin/store", () => ({
  AdminAddressStoreUnavailableError: class AdminAddressStoreUnavailableError extends Error {},
  AdminStoreConflictError: class AdminStoreConflictError extends Error {},
  AdminStoreNotFoundError: class AdminStoreNotFoundError extends Error {},
  createAdminAddress: vi.fn(),
  listAdminAddresses: vi.fn(),
  updateAdminAddress: vi.fn(),
}));

const adminAddress = "0x1234567890abcdef1234567890abcdef12345678";

describe("/api/admin/admin-addresses", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(enforceApiRateLimits).mockResolvedValue({ ok: true });
    vi.mocked(requireAdminRequest).mockResolvedValue({
      ok: true,
      value: {
        address: adminAddress,
      },
    });
  });

  it("returns the admin address list for an authenticated admin", async () => {
    vi.mocked(listAdminAddresses).mockResolvedValue([
      {
        id: "admin-1",
        walletAddress: adminAddress,
        isActive: true,
        remark: "初始管理员",
        createdBy: adminAddress,
        createTime: "2026-04-10T00:00:00.000Z",
        updateTime: "2026-04-10T00:00:00.000Z",
      },
    ]);

    const { GET } = await import("@/app/api/admin/admin-addresses/route");
    const response = await GET(
      createNextRequest("http://localhost/api/admin/admin-addresses")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      currentAddress: adminAddress,
      admins: [
        {
          id: "admin-1",
          walletAddress: adminAddress,
          isActive: true,
          remark: "初始管理员",
          createdBy: adminAddress,
          createTime: "2026-04-10T00:00:00.000Z",
          updateTime: "2026-04-10T00:00:00.000Z",
        },
      ],
    });
  });

  it("creates a new admin address", async () => {
    vi.mocked(createAdminAddress).mockResolvedValue({
      id: "admin-2",
      walletAddress: "0xAbCdEfabcdefABCDEFabcdefabcdefABCDEFabCd",
      isActive: true,
      remark: "新增管理员",
      createdBy: adminAddress,
      createTime: "2026-04-10T00:00:00.000Z",
      updateTime: "2026-04-10T00:00:00.000Z",
    });

    const { POST } = await import("@/app/api/admin/admin-addresses/route");
    const response = await POST(
      createJsonRequest("http://localhost/api/admin/admin-addresses", "POST", {
        walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        remark: "新增管理员",
      })
    );

    expect(response.status).toBe(201);
    expect(createAdminAddress).toHaveBeenCalledWith({
      walletAddress: getAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
      remark: "新增管理员",
      createdBy: adminAddress,
    });
  });

  it("returns 503 when the admin address table is unavailable", async () => {
    vi.mocked(listAdminAddresses).mockRejectedValue(
      new AdminAddressStoreUnavailableError("missing table")
    );

    const { GET } = await import("@/app/api/admin/admin-addresses/route");
    const response = await GET(
      createNextRequest("http://localhost/api/admin/admin-addresses")
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "管理员名单数据表不可用，请先执行数据库迁移",
    });
  });
});

describe("/api/admin/admin-addresses/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(enforceApiRateLimits).mockResolvedValue({ ok: true });
    vi.mocked(requireAdminRequest).mockResolvedValue({
      ok: true,
      value: {
        address: adminAddress,
      },
    });
  });

  it("updates an admin address remark and activation status", async () => {
    vi.mocked(updateAdminAddress).mockResolvedValue({
      id: "admin-1",
      walletAddress: adminAddress,
      isActive: false,
      remark: "停用",
      createdBy: adminAddress,
      createTime: "2026-04-10T00:00:00.000Z",
      updateTime: "2026-04-10T01:00:00.000Z",
    });

    const { PATCH } = await import("@/app/api/admin/admin-addresses/[id]/route");
    const response = await PATCH(
      createJsonRequest(
        "http://localhost/api/admin/admin-addresses/admin-1",
        "PATCH",
        {
          isActive: false,
          remark: "停用",
        }
      ),
      { params: Promise.resolve({ id: "admin-1" }) }
    );

    expect(response.status).toBe(200);
    expect(updateAdminAddress).toHaveBeenCalledWith({
      id: "admin-1",
      isActive: false,
      remark: "停用",
    });
  });

  it("rejects deactivating the last active admin", async () => {
    vi.mocked(updateAdminAddress).mockRejectedValue(
      new AdminStoreConflictError("至少需要保留一个启用中的管理员")
    );

    const { PATCH } = await import("@/app/api/admin/admin-addresses/[id]/route");
    const response = await PATCH(
      createJsonRequest(
        "http://localhost/api/admin/admin-addresses/admin-1",
        "PATCH",
        {
          isActive: false,
        }
      ),
      { params: Promise.resolve({ id: "admin-1" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "至少需要保留一个启用中的管理员",
    });
  });
});
