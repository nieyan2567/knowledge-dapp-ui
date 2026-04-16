/**
 * @notice Faucet 环境配置读取工具。
 * @dev 负责统一读取与校验水龙头相关的 RPC、私钥、金额、冷却和限流配置。
 */
import { parseEther } from "viem";

import { CONTRACTS } from "@/contracts";
import { getServerEnv } from "@/lib/env";
import { FaucetInfraError } from "@/lib/faucet/types";

/**
 * @notice 读取并校验必填的私钥配置。
 * @param keys 允许尝试读取的环境变量键列表。
 * @param label 当前私钥配置的人类可读名称。
 * @returns 对应的私钥字符串。
 */
function getConfiguredPrivateKey(
  keys: Array<"FAUCET_RELAYER_PRIVATE_KEY" | "FAUCET_AUTH_SIGNER_PRIVATE_KEY">,
  label: string
) {
  const env = getServerEnv();

  for (const key of keys) {
    const value = env[key];
    if (value) {
      return value as `0x${string}`;
    }
  }

  throw new Error(`${label} is not configured`);
}

/**
 * @notice 获取 Faucet 使用的 RPC 地址。
 * @returns Besu RPC URL。
 */
export function getRpcUrl() {
  return getServerEnv().NEXT_PUBLIC_BESU_RPC_URL;
}

/**
 * @notice 获取 Faucet Relayer 私钥。
 * @returns Relayer 私钥。
 */
export function getFaucetRelayerPrivateKey() {
  return getConfiguredPrivateKey(
    ["FAUCET_RELAYER_PRIVATE_KEY"],
    "FAUCET_RELAYER_PRIVATE_KEY"
  );
}

/**
 * @notice 获取 Faucet 授权签名者私钥。
 * @returns 授权签名者私钥。
 */
export function getFaucetAuthSignerPrivateKey() {
  return getConfiguredPrivateKey(
    ["FAUCET_AUTH_SIGNER_PRIVATE_KEY"],
    "FAUCET_AUTH_SIGNER_PRIVATE_KEY"
  );
}

/**
 * @notice 获取为 Relayer 补款的钱包私钥。
 * @returns 补款私钥；若未配置则返回 `undefined`。
 */
export function getFaucetTopUpFunderPrivateKey() {
  const value = getServerEnv().FAUCET_TOP_UP_FUNDER_PRIVATE_KEY;
  return value ? (value as `0x${string}`) : undefined;
}

/**
 * @notice 获取 Relayer 告警余额阈值。
 * @returns 解析后的最小告警余额。
 */
export function getFaucetRelayerAlertMinBalance() {
  return parseEther(getServerEnv().FAUCET_RELAYER_ALERT_MIN_BALANCE);
}

/**
 * @notice 获取 Relayer 自动补款金额。
 * @returns 解析后的补款金额。
 */
export function getFaucetRelayerTopUpAmount() {
  return parseEther(getServerEnv().FAUCET_RELAYER_TOP_UP_AMOUNT);
}

/**
 * @notice 获取 FaucetVault 告警余额阈值。
 * @returns 解析后的阈值；若未配置则返回 `undefined`。
 */
export function getFaucetVaultAlertMinBalance() {
  const value = getServerEnv().FAUCET_VAULT_ALERT_MIN_BALANCE;
  return value ? parseEther(value) : undefined;
}

/**
 * @notice 获取 FaucetVault 合约地址。
 * @returns 当前部署环境中的 FaucetVault 地址。
 */
export function getFaucetVaultAddress() {
  const address = CONTRACTS.FaucetVault as `0x${string}` | undefined;
  if (!address) {
    throw new FaucetInfraError("FaucetVault 尚未部署或前端部署信息未同步。");
  }
  return address;
}

/**
 * @notice 获取单次 Faucet 发放金额。
 * @returns 解析后的发放金额。
 */
export function getFaucetAmount() {
  return parseEther(getServerEnv().FAUCET_AMOUNT);
}

/**
 * @notice 获取申请 Faucet 的账户余额上限。
 * @returns 解析后的余额阈值。
 */
export function getFaucetMinBalance() {
  return parseEther(getServerEnv().FAUCET_MIN_BALANCE);
}

/**
 * @notice 获取 Faucet 冷却期秒数。
 * @returns 以秒表示的冷却期长度。
 */
export function getFaucetCooldownSeconds() {
  const hours = getServerEnv().FAUCET_COOLDOWN_HOURS;

  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("FAUCET_COOLDOWN_HOURS must be a positive number");
  }

  return Math.floor(hours * 60 * 60);
}

/**
 * @notice 获取 Faucet 领取锁的 TTL。
 * @returns 锁持续时间，单位为秒。
 */
export function getFaucetLockTtlSeconds() {
  const seconds = getServerEnv().FAUCET_LOCK_TTL_SECONDS;

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("FAUCET_LOCK_TTL_SECONDS must be a positive number");
  }

  return Math.floor(seconds);
}

/**
 * @notice 获取指定限流类型的时间窗口。
 * @param kind 限流类型，可选 `nonce` 或 `claim`。
 * @returns 对应限流窗口的秒数。
 */
export function getRateLimitWindowSeconds(kind: "nonce" | "claim") {
  const env = getServerEnv();
  const value =
    kind === "nonce"
      ? env.FAUCET_NONCE_RATE_LIMIT_WINDOW_SECONDS
      : env.FAUCET_CLAIM_RATE_LIMIT_WINDOW_SECONDS;

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `FAUCET_${kind.toUpperCase()}_RATE_LIMIT_WINDOW_SECONDS must be a positive number`
    );
  }

  return Math.floor(value);
}

/**
 * @notice 获取指定限流类型的最大次数。
 * @param kind 限流类型，可选 `nonce` 或 `claim`。
 * @returns 对应时间窗口内的最大允许次数。
 */
export function getRateLimitMax(kind: "nonce" | "claim") {
  const env = getServerEnv();
  const value =
    kind === "nonce"
      ? env.FAUCET_NONCE_RATE_LIMIT_MAX
      : env.FAUCET_CLAIM_RATE_LIMIT_MAX;

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `FAUCET_${kind.toUpperCase()}_RATE_LIMIT_MAX must be a positive number`
    );
  }

  return Math.floor(value);
}

/**
 * @notice 获取 Faucet 授权签名的最小有效期。
 * @returns 授权签名的截止秒数。
 */
export function getAuthorizationDeadlineSeconds() {
  return Math.max(60, getServerEnv().FAUCET_NONCE_TTL_SECONDS);
}
