/**
 * @notice Faucet 模块共享类型与错误定义。
 * @dev 描述领取记录、锁、资格校验结果、授权结构、维护报告以及错误类型。
 */
import { FAUCET_COPY } from "@/lib/faucet/copy";

/**
 * @notice Faucet 领取记录结构。
 * @dev 用于记录领取地址、金额、交易哈希和来源 IP。
 */
export type FaucetClaimRecord = {
  address: `0x${string}`;
  amount: string;
  txHash: `0x${string}`;
  claimedAt: string;
  ip: string | null;
};

/**
 * @notice Faucet 领取锁结构。
 * @dev 一次领取请求可能同时持有地址锁和 IP 锁。
 */
export type FaucetClaimLock = {
  entries: Array<{
    key: string;
    token: string;
  }>;
};

/**
 * @notice Faucet 领取资格检查结果。
 * @dev 成功时返回可领取金额与门槛，失败时返回状态码和错误文案。
 */
export type FaucetClaimEligibilityResult =
  | {
      ok: true;
      amount: bigint;
      minAllowedBalance: bigint;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

/**
 * @notice Faucet 领取授权结构。
 * @dev 由后端签发，供链上领取函数验证使用。
 */
export type FaucetClaimAuthorization = {
  amount: bigint;
  deadline: bigint;
  nonce: `0x${string}`;
  signature: `0x${string}`;
};

/**
 * @notice Faucet 维护报告结构。
 * @dev 汇总 relayer、top-up 与 FaucetVault 的运行情况。
 */
export type FaucetMaintenanceReport = {
  status: "ok" | "degraded";
  relayer: {
    address: `0x${string}`;
    balance: string;
    alertMinBalance: string;
  };
  topUp: {
    attempted: boolean;
    txHash?: `0x${string}`;
    amount?: string;
    funderAddress?: `0x${string}`;
    error?: string;
  };
  faucetVault: {
    address: `0x${string}`;
    balance: string;
    claimAmount: string;
    availableBudget: string;
    paused: boolean;
    alertMinBalance?: string;
  };
  issues: string[];
};

/**
 * @notice Faucet 业务错误基类。
 * @dev 统一附带 HTTP 状态码，便于 API 层直接转换响应。
 */
export class FaucetError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FaucetError";
    this.status = status;
  }
}

/**
 * @notice Faucet 基础设施错误。
 * @dev 用于表示 Redis、合约地址或依赖服务不可用等问题。
 */
export class FaucetInfraError extends FaucetError {
  constructor(message: string = FAUCET_COPY.errors.serviceUnavailable) {
    super(message, 503);
    this.name = "FaucetInfraError";
  }
}

/**
 * @notice Faucet 限流错误。
 * @dev 用于表示请求频率超过限制。
 */
export class FaucetRateLimitError extends FaucetError {
  constructor(message: string) {
    super(message, 429);
    this.name = "FaucetRateLimitError";
  }
}

/**
 * @notice 判断未知错误是否为 Faucet 业务错误。
 * @param error 待判断的错误对象。
 * @returns 若属于 FaucetError 体系则返回 `true`。
 */
export function isFaucetError(error: unknown): error is FaucetError {
  return error instanceof FaucetError;
}
