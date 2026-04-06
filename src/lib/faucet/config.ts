import { parseEther } from "viem";

import { CONTRACTS } from "@/contracts";
import { getServerEnv } from "@/lib/env";
import { FaucetInfraError } from "@/lib/faucet/types";

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

export function getRpcUrl() {
  return getServerEnv().NEXT_PUBLIC_BESU_RPC_URL;
}

export function getFaucetRelayerPrivateKey() {
  return getConfiguredPrivateKey(
    ["FAUCET_RELAYER_PRIVATE_KEY"],
    "FAUCET_RELAYER_PRIVATE_KEY"
  );
}

export function getFaucetAuthSignerPrivateKey() {
  return getConfiguredPrivateKey(
    ["FAUCET_AUTH_SIGNER_PRIVATE_KEY"],
    "FAUCET_AUTH_SIGNER_PRIVATE_KEY"
  );
}

export function getFaucetTopUpFunderPrivateKey() {
  const value = getServerEnv().FAUCET_TOP_UP_FUNDER_PRIVATE_KEY;
  return value ? (value as `0x${string}`) : undefined;
}

export function getFaucetRelayerAlertMinBalance() {
  return parseEther(getServerEnv().FAUCET_RELAYER_ALERT_MIN_BALANCE);
}

export function getFaucetRelayerTopUpAmount() {
  return parseEther(getServerEnv().FAUCET_RELAYER_TOP_UP_AMOUNT);
}

export function getFaucetVaultAlertMinBalance() {
  const value = getServerEnv().FAUCET_VAULT_ALERT_MIN_BALANCE;
  return value ? parseEther(value) : undefined;
}

export function getFaucetVaultAddress() {
  const address = CONTRACTS.FaucetVault as `0x${string}` | undefined;
  if (!address) {
    throw new FaucetInfraError("FaucetVault 尚未部署或前端部署信息未同步。");
  }
  return address;
}

export function getFaucetAmount() {
  return parseEther(getServerEnv().FAUCET_AMOUNT);
}

export function getFaucetMinBalance() {
  return parseEther(getServerEnv().FAUCET_MIN_BALANCE);
}

export function getFaucetCooldownSeconds() {
  const hours = getServerEnv().FAUCET_COOLDOWN_HOURS;

  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("FAUCET_COOLDOWN_HOURS must be a positive number");
  }

  return Math.floor(hours * 60 * 60);
}

export function getFaucetLockTtlSeconds() {
  const seconds = getServerEnv().FAUCET_LOCK_TTL_SECONDS;

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("FAUCET_LOCK_TTL_SECONDS must be a positive number");
  }

  return Math.floor(seconds);
}

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

export function getAuthorizationDeadlineSeconds() {
  return Math.max(60, getServerEnv().FAUCET_NONCE_TTL_SECONDS);
}
