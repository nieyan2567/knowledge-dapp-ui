import "server-only";

import { getServerEnv } from "@/lib/env";

type JsonRpcSuccess<T> = {
  jsonrpc: "2.0";
  id: number;
  result: T;
};

type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

async function callBesuRpc<T>(url: string, method: string, params: unknown[]) {
  const env = getServerEnv();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.BESU_ADMIN_AUTH_TOKEN
        ? { Authorization: `Bearer ${env.BESU_ADMIN_AUTH_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Besu RPC request failed: ${response.status}`);
  }

  const payload = (await response.json()) as JsonRpcSuccess<T> | JsonRpcFailure;

  if ("error" in payload) {
    throw new Error(`Besu RPC ${method} failed: ${payload.error.message}`);
  }

  return payload.result;
}

export function getPermissioningRpcUrl() {
  const env = getServerEnv();
  return env.BESU_PERMISSIONING_RPC_URL || env.NEXT_PUBLIC_BESU_RPC_URL;
}

export function getValidatorRpcUrls() {
  const env = getServerEnv();
  if (env.BESU_VALIDATOR_RPC_URLS.length > 0) {
    return env.BESU_VALIDATOR_RPC_URLS;
  }

  return [getPermissioningRpcUrl()];
}

export async function callPermissioningRpc<T>(
  method: string,
  params: unknown[] = []
) {
  return callBesuRpc<T>(getPermissioningRpcUrl(), method, params);
}

export async function callValidatorRpc<T>(
  url: string,
  method: string,
  params: unknown[] = []
) {
  return callBesuRpc<T>(url, method, params);
}
