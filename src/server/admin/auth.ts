import "server-only";

import type { NextRequest } from "next/server";
import { getAddress } from "viem";

import { errorResponse, type ValidationResult } from "@/lib/api-validation";
import { readUploadSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";

export type AdminRequestContext = {
  address: `0x${string}` | null;
  isAdmin: boolean;
};

function normalizeAddressList(value: string | undefined) {
  if (!value) {
    return new Set<string>();
  }

  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => getAddress(item).toLowerCase())
  );
}

export function getAdminAddressSet() {
  return normalizeAddressList(getServerEnv().ADMIN_ADDRESSES);
}

export async function readAdminRequestContext(
  req: NextRequest
): Promise<AdminRequestContext> {
  const session = await readUploadSession(req);
  const address = session?.sub ?? null;
  const adminAddresses = getAdminAddressSet();

  return {
    address,
    isAdmin: !!address && adminAddresses.has(address.toLowerCase()),
  };
}

export async function requireAuthenticatedRequest(
  req: NextRequest
): Promise<ValidationResult<{ address: `0x${string}` }>> {
  const session = await readUploadSession(req);

  if (!session) {
    return {
      ok: false,
      response: errorResponse("请先完成钱包签名验证", 401),
    };
  }

  return {
    ok: true,
    value: {
      address: session.sub,
    },
  };
}

export async function requireAdminRequest(
  req: NextRequest
): Promise<ValidationResult<{ address: `0x${string}` }>> {
  const context = await readAdminRequestContext(req);

  if (!context.address) {
    return {
      ok: false,
      response: errorResponse("请先完成钱包签名验证", 401),
    };
  }

  if (!context.isAdmin) {
    return {
      ok: false,
      response: errorResponse("当前钱包没有管理员权限", 403),
    };
  }

  return {
    ok: true,
    value: {
      address: context.address,
    },
  };
}
