import { beforeEach, describe, expect, it, vi } from "vitest";

import { createNextRequest } from "@/test/api-route";
import { readUploadSession } from "@/lib/auth/session";
import {
  AdminAddressStoreUnavailableError,
  hasAnyAdminAddresses,
  isAdminAddress,
} from "@/server/admin/store";

vi.mock("@/lib/auth/session", () => ({
  readUploadSession: vi.fn(),
}));

vi.mock("@/server/admin/store", () => ({
  AdminAddressStoreUnavailableError: class AdminAddressStoreUnavailableError extends Error {},
  hasAnyAdminAddresses: vi.fn(),
  isAdminAddress: vi.fn(),
}));

const address = "0x1234567890abcdef1234567890abcdef12345678";

function createSession() {
  return {
    id: "session-1",
    sub: address,
    chainId: 20260,
    version: 1,
    createdAt: 1,
    expiresAt: 2,
    lastUsedAt: 1,
  } satisfies Awaited<ReturnType<typeof readUploadSession>>;
}

describe("server/admin/auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    delete process.env.ADMIN_ADDRESSES;
  });

  it("uses the database admin list when persisted admins exist", async () => {
    process.env.ADMIN_ADDRESSES = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    vi.mocked(readUploadSession).mockResolvedValue(createSession());
    vi.mocked(hasAnyAdminAddresses).mockResolvedValue(true);
    vi.mocked(isAdminAddress).mockResolvedValue(true);

    const { readAdminRequestContext } = await import("./auth");
    const context = await readAdminRequestContext(
      createNextRequest("http://localhost/api/admin/overview")
    );

    expect(context).toEqual({
      address,
      isAdmin: true,
    });
    expect(isAdminAddress).toHaveBeenCalledWith(address);
  });

  it("falls back to ADMIN_ADDRESSES when no persisted admin exists yet", async () => {
    process.env.ADMIN_ADDRESSES = address;
    vi.mocked(readUploadSession).mockResolvedValue(createSession());
    vi.mocked(hasAnyAdminAddresses).mockResolvedValue(false);

    const { readAdminRequestContext } = await import("./auth");
    const context = await readAdminRequestContext(
      createNextRequest("http://localhost/api/admin/overview")
    );

    expect(context).toEqual({
      address,
      isAdmin: true,
    });
    expect(isAdminAddress).not.toHaveBeenCalled();
  });

  it("falls back to ADMIN_ADDRESSES when admin_address table is unavailable", async () => {
    process.env.ADMIN_ADDRESSES = address;
    vi.mocked(readUploadSession).mockResolvedValue(createSession());
    vi.mocked(hasAnyAdminAddresses).mockRejectedValue(
      new AdminAddressStoreUnavailableError("missing table")
    );

    const { readAdminRequestContext } = await import("./auth");
    const context = await readAdminRequestContext(
      createNextRequest("http://localhost/api/admin/overview")
    );

    expect(context).toEqual({
      address,
      isAdmin: true,
    });
  });

  it("returns 403 from requireAdminRequest when the wallet is not an admin", async () => {
    vi.mocked(readUploadSession).mockResolvedValue(createSession());
    vi.mocked(hasAnyAdminAddresses).mockResolvedValue(true);
    vi.mocked(isAdminAddress).mockResolvedValue(false);

    const { requireAdminRequest } = await import("./auth");
    const result = await requireAdminRequest(
      createNextRequest("http://localhost/api/admin/overview")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({
        error: "当前钱包没有管理员权限",
      });
    }
  });
});
