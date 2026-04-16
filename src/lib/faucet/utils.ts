/**
 * @notice Faucet 模块服务端聚合导出入口。
 * @dev 统一转发 Faucet 配置、客户端、资格校验、限流和类型定义，供 API 与任务复用。
 */
import "server-only";

import { FAUCET_COPY, getFaucetCooldownMessage, getFaucetMinBalanceMessage, getFaucetRateLimitMessage } from "@/lib/faucet/copy";
import {
  getAuthorizationDeadlineSeconds,
  getFaucetAmount,
  getFaucetAuthSignerPrivateKey,
  getFaucetCooldownSeconds,
  getFaucetLockTtlSeconds,
  getFaucetMinBalance,
  getFaucetRelayerAlertMinBalance,
  getFaucetRelayerPrivateKey,
  getFaucetRelayerTopUpAmount,
  getFaucetTopUpFunderPrivateKey,
  getFaucetVaultAddress,
  getFaucetVaultAlertMinBalance,
  getRateLimitMax,
  getRateLimitWindowSeconds,
  getRpcUrl,
} from "@/lib/faucet/config";
import {
  createFaucetClaimAuthorization,
  getFaucetClients,
  readFaucetVaultConfig,
  rebalanceRevenueVault,
  runFaucetMaintenance,
  submitFaucetClaim,
} from "@/lib/faucet/client";
import { checkFaucetClaimEligibility } from "@/lib/faucet/eligibility";
import {
  createRequestContextHashes,
  formatFaucetAmount,
  getRequestIp,
  getRequestUserAgent,
} from "@/lib/faucet/request-context";
import {
  acquireFaucetClaimLock,
  enforceFaucetRateLimit,
  getCooldownRemainingSeconds,
  markFaucetClaimed,
  releaseFaucetClaimLock,
} from "@/lib/faucet/store";
import {
  FaucetError,
  FaucetInfraError,
  FaucetRateLimitError,
  isFaucetError,
  type FaucetClaimAuthorization,
  type FaucetClaimEligibilityResult,
  type FaucetClaimLock,
  type FaucetClaimRecord,
  type FaucetMaintenanceReport,
} from "@/lib/faucet/types";

/**
 * @notice 重新导出 Faucet 共享类型。
 * @dev 便于其他模块从单一入口导入 Faucet 类型定义。
 */
export type {
  FaucetClaimAuthorization,
  FaucetClaimEligibilityResult,
  FaucetClaimLock,
  FaucetClaimRecord,
  FaucetMaintenanceReport,
};

/**
 * @notice 重新导出 Faucet 服务端能力集合。
 * @dev 包括文案、配置读取、客户端调用、资格校验和状态存储等能力。
 */
export {
  FAUCET_COPY,
  FaucetError,
  FaucetInfraError,
  FaucetRateLimitError,
  acquireFaucetClaimLock,
  checkFaucetClaimEligibility,
  createFaucetClaimAuthorization,
  createRequestContextHashes,
  enforceFaucetRateLimit,
  formatFaucetAmount,
  getAuthorizationDeadlineSeconds,
  getCooldownRemainingSeconds,
  getFaucetAmount,
  getFaucetAuthSignerPrivateKey,
  getFaucetClients,
  getFaucetCooldownMessage,
  getFaucetCooldownSeconds,
  getFaucetLockTtlSeconds,
  getFaucetMinBalance,
  getFaucetMinBalanceMessage,
  getFaucetRateLimitMessage,
  getFaucetRelayerAlertMinBalance,
  getFaucetRelayerPrivateKey,
  getFaucetRelayerTopUpAmount,
  getFaucetTopUpFunderPrivateKey,
  getFaucetVaultAddress,
  getFaucetVaultAlertMinBalance,
  getRateLimitMax,
  getRateLimitWindowSeconds,
  getRequestIp,
  getRequestUserAgent,
  getRpcUrl,
  isFaucetError,
  markFaucetClaimed,
  readFaucetVaultConfig,
  rebalanceRevenueVault,
  releaseFaucetClaimLock,
  runFaucetMaintenance,
  submitFaucetClaim,
};
