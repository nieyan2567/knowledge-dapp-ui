/**
 * @notice 交易提示与错误分类工具。
 * @dev 统一处理交易模拟、提交阶段的提示文案、错误分类和客户端可观测性上报。
 */
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

/**
 * @notice 交易错误分类枚举。
 * @dev 用于区分用户拒绝、错链、余额不足、合约回滚等场景。
 */
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

/**
 * @notice 交易错误发生阶段。
 * @dev 分为预检模拟阶段和正式提交阶段。
 */
export type TransactionErrorPhase = "simulation" | "submission";

/**
 * @notice 归类后的交易错误结构。
 * @dev 包含类别、阶段、展示文案、原始消息以及是否需要上报。
 */
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
    pattern: "no new votes",
    message: "当前没有新增票数可记账",
  },
  {
    pattern: "not author",
    message: "只有内容作者可以执行该操作",
  },
  {
    pattern: "content deleted",
    message: "内容已删除，当前操作不可用",
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

/**
 * @notice 对交易错误进行归类并生成统一展示信息。
 * @param error 原始错误对象。
 * @param fallback 无法识别时使用的回退文案。
 * @param phase 当前错误所处阶段，默认值为 `submission`。
 * @returns 归类后的交易错误对象。
 */
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
        message === fallback
          ? "交易预检查失败，请确认参数和链上状态"
          : message,
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

/**
 * @notice 根据错误分类展示交易提示并在必要时上报可观测性。
 * @param error 原始错误对象。
 * @param fail 失败回退文案。
 * @param id 已存在的 toast ID。
 * @param phase 当前错误所处阶段。
 * @returns 当前函数不返回值，仅负责提示与上报。
 */
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

/**
 * @notice 为 Promise 交易流程包裹统一 toast 提示。
 * @param promise 代表交易流程的 Promise。
 * @param loading 加载中提示文案。
 * @param success 成功提示文案。
 * @param fail 失败提示文案。
 * @returns 原 Promise 成功解析后的结果。
 */
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

/**
 * @notice 为合约写入流程提供预检与 toast 提示封装。
 * @param input 写入流程所需输入。
 * @param input.publicClient 可选的公共客户端，用于交易前模拟。
 * @param input.writeContractAsync 实际执行写入的函数。
 * @param input.request 合约写入请求参数。
 * @param input.loading 加载中提示文案。
 * @param input.success 成功提示文案。
 * @param input.fail 失败提示文案。
 * @returns 成功时返回交易哈希；若模拟或提交失败则返回 `null`。
 */
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
  /**
   * @notice 若提供公共客户端，则先执行模拟预检。
   * @dev 这样可以在真正弹出钱包前尽早暴露可预见的链上错误。
   */
  if (publicClient) {
    try {
      await publicClient.simulateContract(request);
    } catch (error) {
      showTxErrorToast(error, fail, undefined, "simulation");
      return null;
    }
  }

  try {
    return await txToast(writeContractAsync(request), loading, success, fail);
  } catch {
    return null;
  }
}
