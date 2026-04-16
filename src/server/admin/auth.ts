/**
 * @file Admin 请求鉴权模块。
 * @description 负责读取管理员请求上下文，并在 API 层校验登录态和管理员权限。
 */
import "server-only";

import type { NextRequest } from "next/server";
import { getAddress } from "viem";

import { errorResponse, type ValidationResult } from "@/lib/api-validation";
import { readUploadSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import {
  AdminAddressStoreUnavailableError,
  hasAnyAdminAddresses,
  isAdminAddress,
} from "@/server/admin/store";

/**
 * @notice 管理端请求上下文。
 * @dev 同时暴露当前登录地址和是否具有管理员权限。
 */
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

/**
 * @notice 读取环境变量中的启动管理员地址集合。
 * @returns 归一化后的管理员地址集合。
 */
export function getBootstrapAdminAddressSet() {
  return normalizeAddressList(getServerEnv().ADMIN_ADDRESSES);
}

async function resolveAdminStatus(address: `0x${string}`) {
  const normalizedAddress = address.toLowerCase();

  try {
    const hasPersistedAdmins = await hasAnyAdminAddresses();

    if (hasPersistedAdmins) {
      return await isAdminAddress(address);
    }
  } catch (error) {
    if (!(error instanceof AdminAddressStoreUnavailableError)) {
      throw error;
    }
  }

  return getBootstrapAdminAddressSet().has(normalizedAddress);
}

/**
 * @notice 读取当前请求对应的管理员上下文。
 * @param req 当前请求对象。
 * @returns 包含地址和管理员状态的上下文对象。
 */
export async function readAdminRequestContext(
  req: NextRequest
): Promise<AdminRequestContext> {
  const session = await readUploadSession(req);
  const address = session?.sub ?? null;

  return {
    address,
    isAdmin: address ? await resolveAdminStatus(address) : false,
  };
}

/**
 * @notice 校验请求是否已完成钱包登录。
 * @param req 当前请求对象。
 * @returns 成功时返回登录钱包地址，失败时返回 401 响应。
 */
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

/**
 * @notice 校验请求是否来自管理员钱包。
 * @param req 当前请求对象。
 * @returns 成功时返回管理员钱包地址，失败时返回鉴权错误响应。
 */
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
