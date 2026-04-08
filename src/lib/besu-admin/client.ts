import "server-only";

import { getServerEnv } from "@/lib/env";

type JsonRpcSuccess<T> = {
  jsonrpc: "2.0";
  id: number;
  result: T;
};

type JsonRpcError = {
  jsonrpc: "2.0";
  id: number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

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
