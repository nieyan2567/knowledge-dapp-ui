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

export type {
  FaucetClaimAuthorization,
  FaucetClaimEligibilityResult,
  FaucetClaimLock,
  FaucetClaimRecord,
  FaucetMaintenanceReport,
};

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
