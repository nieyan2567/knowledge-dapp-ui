import "server-only";

import { createPublicClient, createWalletClient, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { knowledgeChain } from "@/lib/chains";
import { getRedis } from "@/lib/redis";

export type FaucetClaimRecord = {
  address: `0x${string}`;
  amount: string;
  txHash: `0x${string}`;
  claimedAt: string;
  ip: string | null;
};

export type FaucetClaimLock = {
  key: string;
  token: string;
};

let faucetClients:
  | {
      publicClient: ReturnType<typeof createPublicClient>;
      walletClient: ReturnType<typeof createWalletClient>;
      account: ReturnType<typeof privateKeyToAccount>;
    }
  | undefined;

function getRpcUrl() {
  return process.env.NEXT_PUBLIC_BESU_RPC_URL || "http://127.0.0.1:8545";
}

function getFaucetPrivateKey() {
  const privateKey = process.env.FAUCET_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("FAUCET_PRIVATE_KEY is not configured");
  }

  if (!privateKey.startsWith("0x")) {
    throw new Error("FAUCET_PRIVATE_KEY must start with 0x");
  }

  return privateKey as `0x${string}`;
}

export function getFaucetAmount() {
  return parseEther(process.env.FAUCET_AMOUNT || "0.05");
}

export function getFaucetMinBalance() {
  return parseEther(process.env.FAUCET_MIN_BALANCE || "0.02");
}

export function getFaucetCooldownSeconds() {
  const hours = Number(process.env.FAUCET_COOLDOWN_HOURS || "24");

  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("FAUCET_COOLDOWN_HOURS must be a positive number");
  }

  return Math.floor(hours * 60 * 60);
}

export function getRequestIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return headers.get("x-real-ip");
}

function getAddressClaimKey(address: `0x${string}`) {
  return `faucet_claim:address:${address.toLowerCase()}`;
}

function getAddressLockKey(address: `0x${string}`) {
  return `faucet_lock:address:${address.toLowerCase()}`;
}

export async function getFaucetClients() {
  if (faucetClients) {
    return faucetClients;
  }

  const account = privateKeyToAccount(getFaucetPrivateKey());
  const transport = http(getRpcUrl());

  faucetClients = {
    account,
    publicClient: createPublicClient({
      chain: knowledgeChain,
      transport,
    }),
    walletClient: createWalletClient({
      account,
      chain: knowledgeChain,
      transport,
    }),
  };

  return faucetClients;
}

export async function getCooldownRemainingSeconds(
  address: `0x${string}`,
  ip: string | null
) {
  const redis = await getRedis();

  if (!redis) {
    throw new Error("Redis is required for the faucet backend");
  }

  const addressTtl = await redis.ttl(getAddressClaimKey(address));
  void ip;

  return Math.max(addressTtl, 0);
}

export async function acquireFaucetClaimLock(
  address: `0x${string}`
): Promise<FaucetClaimLock | null> {
  const redis = await getRedis();

  if (!redis) {
    throw new Error("Redis is required for the faucet backend");
  }

  const key = getAddressLockKey(address);
  const token = crypto.randomUUID();
  const lockSeconds = Math.max(getFaucetCooldownSeconds(), 60);

  const result = await redis.set(key, token, {
    NX: true,
    EX: lockSeconds,
  });

  if (result !== "OK") {
    return null;
  }

  return { key, token };
}

export async function releaseFaucetClaimLock(lock: FaucetClaimLock) {
  const redis = await getRedis();

  if (!redis) {
    throw new Error("Redis is required for the faucet backend");
  }

  const currentToken = await redis.get(lock.key);

  if (currentToken === lock.token) {
    await redis.del(lock.key);
  }
}

export async function markFaucetClaimed(record: FaucetClaimRecord) {
  const redis = await getRedis();

  if (!redis) {
    throw new Error("Redis is required for the faucet backend");
  }

  const ttl = getFaucetCooldownSeconds();
  const payload = JSON.stringify(record);

  await redis.set(getAddressClaimKey(record.address), payload, { EX: ttl });
}

export function formatFaucetAmount(value: bigint) {
  return `${formatEther(value)} ${knowledgeChain.nativeCurrency.symbol}`;
}
