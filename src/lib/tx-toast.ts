import type { Abi } from "viem";
import { BaseError } from "viem";
import { toast } from "sonner";

import { reportClientError } from "@/lib/observability/client";

type ContractWriteRequest = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  account?: `0x${string}`;
  value?: bigint;
};

type PublicClientLike = {
  simulateContract: (request: ContractWriteRequest) => Promise<unknown>;
};

type WriteContractAsyncLike = (
  request: ContractWriteRequest
) => Promise<`0x${string}`>;

export type TransactionErrorCategory =
  | "user_rejected"
  | "wrong_chain"
  | "insufficient_funds"
  | "contract_revert"
  | "rpc_timeout"
  | "network_error"
  | "wallet_internal_error"
  | "simulation_failed"
  | "unknown";

export type TransactionErrorPhase = "simulation" | "submission";

export type ClassifiedTransactionError = {
  category: TransactionErrorCategory;
  phase: TransactionErrorPhase;
  message: string;
  rawMessage?: string;
  report: boolean;
  severity: "warn" | "error";
};

const localizedKnownMessages = [
  {
    pattern: "governor: proposer votes below proposal threshold",
    message: "当前投票权低于提案门槛，无法发起提案",
  },
  {
    pattern: "already accrued",
    message: "该内容的奖励已经记账，不能重复记账",
  },
  {
    pattern: "not enough votes",
    message: "当前票数不足，暂时不能发放奖励",
  },
  {
    pattern: "insufficient pending",
    message: "待提取余额不足，无法提取",
  },
  {
    pattern: "insufficient staked",
    message: "已质押余额不足，无法发起退出申请",
  },
  {
    pattern: "amount=0",
    message: "请输入大于 0 的数量",
  },
  {
    pattern: "no pending",
    message: "当前没有待激活的质押",
  },
  {
    pattern: "not ready",
    message: "当前还没到可激活时间，请稍后再试",
  },
  {
    pattern: "cooldown",
    message: "当前还在冷却期内，暂时不能提取",
  },
  {
    pattern: "timelockcontroller: underlying transaction reverted",
    message: "提案执行失败：目标合约拒绝了这次执行，请检查提案参数",
  },
  {
    pattern: "stake too low",
    message: "当前质押或投票权不足，无法投票",
  },
  {
    pattern: "already voted",
    message: "该地址已经完成投票，不能重复投票",
  },
];

function getErrorObjects(error: unknown) {
  const objects: unknown[] = [error];

  if (typeof error === "object" && error !== null && "cause" in error) {
    objects.push((error as { cause?: unknown }).cause);
  }

  return objects.filter(Boolean);
}

function getErrorMessages(error: unknown) {
  const messages: string[] = [];

  for (const candidate of getErrorObjects(error)) {
    if (candidate instanceof BaseError) {
      const shortMessage = candidate.shortMessage?.trim();
      if (
        shortMessage &&
        !shortMessage.toLowerCase().startsWith("an unknown error occurred")
      ) {
        messages.push(shortMessage);
      }
    }

    if (typeof candidate === "object" && candidate !== null) {
      const shortMessage = (candidate as { shortMessage?: unknown }).shortMessage;
      const message = (candidate as { message?: unknown }).message;

      if (typeof shortMessage === "string" && shortMessage.trim()) {
        messages.push(shortMessage.trim());
      }

      if (typeof message === "string" && message.trim()) {
        messages.push(message.trim());
      }
    }
  }

  return Array.from(new Set(messages));
}

function getErrorCodes(error: unknown) {
  return getErrorObjects(error)
    .map((candidate) =>
      typeof candidate === "object" && candidate !== null
        ? (candidate as { code?: unknown }).code
        : undefined
    )
    .filter((code) => code !== undefined);
}

function findLocalizedKnownMessage(message: string) {
  const normalized = message.toLowerCase();
  const match = localizedKnownMessages.find(({ pattern }) =>
    normalized.includes(pattern)
  );

  return match?.message;
}

function extractErrorMessage(error: unknown, fallback: string) {
  const messages = getErrorMessages(error);

  for (const candidate of messages) {
    const localized = findLocalizedKnownMessage(candidate);
    if (localized) {
      return localized;
    }

    return candidate;
  }

  return fallback;
}

function includesAny(message: string, patterns: string[]) {
  return patterns.some((pattern) => message.includes(pattern));
}

export function classifyTransactionError(
  error: unknown,
  fallback: string,
  phase: TransactionErrorPhase = "submission"
): ClassifiedTransactionError {
  const messages = getErrorMessages(error);
  const rawMessage = messages[0];
  const normalized = messages.join(" ").toLowerCase();
  const codes = getErrorCodes(error);
  const message = extractErrorMessage(error, fallback);

  if (
    codes.includes(4001) ||
    codes.includes("ACTION_REJECTED") ||
    includesAny(normalized, [
      "user rejected",
      "user denied",
      "rejected the request",
      "denied transaction signature",
      "denied message signature",
    ])
  ) {
    return {
      category: "user_rejected",
      phase,
      message: "已取消本次钱包签名",
      rawMessage,
      report: false,
      severity: "warn",
    };
  }

  if (
    codes.includes(4901) ||
    codes.includes(4902) ||
    includesAny(normalized, [
      "wrong network",
      "wrong chain",
      "chain mismatch",
      "network mismatch",
      "switch network",
      "switch chain",
      "does not match the target chain",
      "chain not configured",
    ])
  ) {
    return {
      category: "wrong_chain",
      phase,
      message: "当前钱包网络不正确，请切换到目标链后重试",
      rawMessage,
      report: false,
      severity: "warn",
    };
  }

  if (
    includesAny(normalized, [
      "insufficient funds",
      "exceeds balance",
      "not enough balance",
      "gas required exceeds allowance",
    ])
  ) {
    return {
      category: "insufficient_funds",
      phase,
      message: "余额不足，无法支付交易所需费用",
      rawMessage,
      report: false,
      severity: "warn",
    };
  }

  if (
    includesAny(normalized, [
      "timeout",
      "timed out",
      "deadline exceeded",
      "gateway timeout",
      "headers timeout",
    ])
  ) {
    return {
      category: "rpc_timeout",
      phase,
      message: "链上请求超时，请稍后重试",
      rawMessage,
      report: true,
      severity: "warn",
    };
  }

  if (
    includesAny(normalized, [
      "network error",
      "fetch failed",
      "failed to fetch",
      "connection refused",
      "disconnected",
      "econnreset",
      "econnrefused",
      "enotfound",
      "503 service unavailable",
    ])
  ) {
    return {
      category: "network_error",
      phase,
      message: "网络连接异常，请稍后重试",
      rawMessage,
      report: true,
      severity: "warn",
    };
  }

  if (
    includesAny(normalized, [
      "internal json-rpc error",
      "wallet",
      "provider",
      "connector",
      "unsupported method",
      "could not coalesce error",
    ])
  ) {
    return {
      category: "wallet_internal_error",
      phase,
      message: "钱包返回异常，请重试或重新连接钱包",
      rawMessage,
      report: true,
      severity: "error",
    };
  }

  if (
    includesAny(normalized, [
      "execution reverted",
      "reverted",
      "revert",
      ...localizedKnownMessages.map(({ pattern }) => pattern),
    ])
  ) {
    return {
      category: "contract_revert",
      phase,
      message,
      rawMessage,
      report: false,
      severity: "warn",
    };
  }

  if (phase === "simulation") {
    return {
      category: "simulation_failed",
      phase,
      message:
        message === fallback ? "交易预检查失败，请确认参数和链上状态" : message,
      rawMessage,
      report: true,
      severity: "warn",
    };
  }

  return {
    category: "unknown",
    phase,
    message,
    rawMessage,
    report: true,
    severity: "error",
  };
}

function showTxErrorToast(
  error: unknown,
  fail: string,
  id?: string | number,
  phase: TransactionErrorPhase = "submission"
) {
  const classified = classifyTransactionError(error, fail, phase);

  if (classified.category === "user_rejected") {
    toast.info(classified.message, { id });
    return;
  }

  if (classified.report) {
    void reportClientError({
      message: fail,
      source: "tx-toast",
      severity: classified.severity,
      handled: true,
      error,
      context: {
        category: classified.category,
        phase: classified.phase,
        rawMessage: classified.rawMessage,
      },
    });
  }

  toast.error(classified.message, { id });
}

export async function txToast<T>(
  promise: Promise<T>,
  loading: string,
  success: string,
  fail: string
): Promise<T> {
  const id = toast.loading(loading);

  try {
    const tx = await promise;
    toast.success(success, { id });
    return tx;
  } catch (error) {
    showTxErrorToast(error, fail, id, "submission");
    throw error;
  }
}

export async function writeTxToast({
  publicClient,
  writeContractAsync,
  request,
  loading,
  success,
  fail,
}: {
  publicClient?: PublicClientLike | null;
  writeContractAsync: WriteContractAsyncLike;
  request: ContractWriteRequest;
  loading: string;
  success: string;
  fail: string;
}): Promise<`0x${string}` | null> {
  if (publicClient) {
    try {
      await publicClient.simulateContract(request);
    } catch (error) {
      showTxErrorToast(error, fail, undefined, "simulation");
      return null;
    }
  }

  try {
    return await txToast(
      writeContractAsync(request),
      loading,
      success,
      fail
    );
  } catch {
    return null;
  }
}
