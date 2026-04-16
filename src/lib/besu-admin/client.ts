/**
 * @notice Besu Admin RPC 客户端封装。
 * @dev 统一处理管理 RPC 的配置读取、JSON-RPC 调用、错误转换与鉴权头附加。
 */
import "server-only";

import { getServerEnv } from "@/lib/env";

/**
 * @notice JSON-RPC 成功响应结构。
 * @dev 表示 Besu Admin RPC 正常返回结果的标准格式。
 */
type JsonRpcSuccess<T> = {
  jsonrpc: "2.0";
  id: number;
  result: T;
};

/**
 * @notice JSON-RPC 错误响应结构。
 * @dev 表示 Besu Admin RPC 返回错误时的标准格式。
 */
type JsonRpcError = {
  jsonrpc: "2.0";
  id: number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

/**
 * @notice Besu Admin RPC 调用错误类型。
 * @dev 保留 RPC 错误码和附加数据，便于上层做细粒度处理。
 */
export class BesuAdminRpcError extends Error {
  code?: number;
  data?: unknown;

  constructor(message: string, options?: { code?: number; data?: unknown }) {
    super(message);
    this.name = "BesuAdminRpcError";
    this.code = options?.code;
    this.data = options?.data;
  }
}

function getBesuAdminRpcConfig() {
  const env = getServerEnv();

  return {
    url: env.BESU_ADMIN_RPC_URL ?? env.NEXT_PUBLIC_BESU_RPC_URL,
    token: env.BESU_ADMIN_RPC_TOKEN,
  };
}

/**
 * @notice 调用一条 Besu Admin JSON-RPC 方法。
 * @param method 目标 RPC 方法名。
 * @param params RPC 参数数组。
 * @returns RPC 返回的结果对象。
 */
export async function callBesuAdminRpc<TResult>(
  method: string,
  params: unknown[] = []
): Promise<TResult> {
  const config = getBesuAdminRpcConfig();
  let response: Response;

  try {
    response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
      cache: "no-store",
    });
  } catch (error) {
    throw new BesuAdminRpcError(
      `Failed to reach Besu admin RPC at ${config.url}: ${
        error instanceof Error ? error.message : "unknown network error"
      }`
    );
  }

  if (!response.ok) {
    let detail = "";

    try {
      detail = (await response.text()).trim();
    } catch {
      detail = "";
    }

    throw new BesuAdminRpcError(
      detail
        ? `Besu admin RPC request failed: HTTP ${response.status} - ${detail}`
        : `Besu admin RPC request failed: HTTP ${response.status}`
    );
  }

  const payload = (await response.json()) as
    | JsonRpcSuccess<TResult>
    | JsonRpcError;

  if ("error" in payload) {
    throw new BesuAdminRpcError(payload.error.message, {
      code: payload.error.code,
      data: payload.error.data,
    });
  }

  return payload.result;
}
