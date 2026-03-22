import type { Abi } from "viem";
import { BaseError } from "viem";
import { toast } from "sonner";

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

type WriteContractAsyncLike = (request: ContractWriteRequest) => Promise<`0x${string}`>;

function localizeErrorMessage(message: string) {
  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (lower.includes("governor: proposer votes below proposal threshold")) {
    return "当前投票权低于提案门槛，无法发起提案";
  }

  if (lower.includes("already accrued")) {
    return "该内容的奖励已经记账，不能重复记账";
  }

  if (lower.includes("not enough votes")) {
    return "当前票数不足，暂时不能发放奖励";
  }

  if (lower.includes("insufficient pending")) {
    return "待提取余额不足，无法提取";
  }

  if (lower.includes("insufficient staked")) {
    return "已质押余额不足，无法发起退出申请";
  }

  if (lower.includes("amount=0")) {
    return "请输入大于 0 的数量";
  }

  if (lower.includes("no pending")) {
    return "当前没有待激活的质押";
  }

  if (lower.includes("not ready")) {
    return "当前还没到可激活时间，请稍后再试";
  }

  if (lower.includes("cooldown")) {
    return "当前还在冷却期内，暂时不能提取";
  }

  if (lower.includes("timelockcontroller: underlying transaction reverted")) {
    return "提案执行失败：目标合约拒绝了这次执行，请检查提案参数是否有效";
  }

  if (lower.includes("stake too low")) {
    return "当前质押或投票权不足，无法投票";
  }

  if (lower.includes("already voted")) {
    return "该地址已完成投票，不能重复投票";
  }

  return normalized;
}

function isUserRejectedError(error: unknown) {
  const candidates = [
    error,
    typeof error === "object" && error !== null ? (error as { cause?: unknown }).cause : undefined,
  ];

  return candidates.some((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }

    const code = (candidate as { code?: unknown }).code;
    const message = `${(candidate as { shortMessage?: string }).shortMessage ?? ""} ${
      (candidate as { message?: string }).message ?? ""
    }`.toLowerCase();

    return (
      code === 4001 ||
      code === "ACTION_REJECTED" ||
      message.includes("user rejected") ||
      message.includes("user denied") ||
      message.includes("rejected the request") ||
      message.includes("denied transaction signature")
    );
  });
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof BaseError) {
    const message = error.shortMessage?.trim();
    if (message && !message.toLowerCase().startsWith("an unknown error occurred")) {
      return localizeErrorMessage(message);
    }
  }

  const candidates = [
    typeof error === "object" && error !== null ? (error as { shortMessage?: string }).shortMessage : undefined,
    typeof error === "object" && error !== null ? (error as { message?: string }).message : undefined,
    typeof error === "object" && error !== null
      ? ((error as { cause?: { shortMessage?: string } }).cause?.shortMessage ?? undefined)
      : undefined,
    typeof error === "object" && error !== null
      ? ((error as { cause?: { message?: string } }).cause?.message ?? undefined)
      : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return localizeErrorMessage(candidate);
    }
  }

  return fallback;
}

function showTxErrorToast(error: unknown, fail: string, id?: string | number) {
  if (isUserRejectedError(error)) {
    toast.info("已取消交易签名", { id });
    return;
  }

  toast.error(extractErrorMessage(error, fail), { id });
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
  } catch (err) {
    showTxErrorToast(err, fail, id);
    throw err;
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
      showTxErrorToast(error, fail);
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
