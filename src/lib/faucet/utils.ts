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
  entries: Array<{
    key: string;
    token: string;
  }>;
};

export type FaucetClaimEligibilityResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: number;
      error: string;
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

function normalizeIp(ip: string | null) {
  const value = ip?.trim();
  return value ? value.toLowerCase() : null;
}

function getAddressClaimKey(address: `0x${string}`) {
  return `faucet_claim:address:${address.toLowerCase()}`;
}

function getIpClaimKey(ip: string) {
  return `faucet_claim:ip:${ip}`;
}

function getAddressLockKey(address: `0x${string}`) {
  return `faucet_lock:address:${address.toLowerCase()}`;
}

function getIpLockKey(ip: string) {
  return `faucet_lock:ip:${ip}`;
}

async function getPositiveTtl(redis: Awaited<ReturnType<typeof getRedis>>, key: string) {
  if (!redis) {
    throw new Error("Redis is required for the faucet backend");
  }

  const ttl = await redis.ttl(key);
  return Math.max(ttl, 0);
}

export function getFaucetAmount() {
  return parseEther(process.env.FAUCET_AMOUNT || "2");
}

export function getFaucetMinBalance() {
  return parseEther(process.env.FAUCET_MIN_BALANCE || "1");
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

  const normalizedIp = normalizeIp(ip);
  const ttlValues = await Promise.all([
    getPositiveTtl(redis, getAddressClaimKey(address)),
    getPositiveTtl(redis, getAddressLockKey(address)),
    normalizedIp ? getPositiveTtl(redis, getIpClaimKey(normalizedIp)) : Promise.resolve(0),
    normalizedIp ? getPositiveTtl(redis, getIpLockKey(normalizedIp)) : Promise.resolve(0),
  ]);

  return Math.max(...ttlValues, 0);
}

export async function checkFaucetClaimEligibility(
  address: `0x${string}`,
  ip: string | null
): Promise<FaucetClaimEligibilityResult> {
  const cooldownRemainingSeconds = await getCooldownRemainingSeconds(address, ip);

  if (cooldownRemainingSeconds > 0) {
    return {
      ok: false,
      status: 429,
      error: `Faucet 冷却中，请在 ${cooldownRemainingSeconds} 秒后重试。`,
    };
  }

  const amount = getFaucetAmount();
  const minBalance = getFaucetMinBalance();
  const { account, publicClient } = await getFaucetClients();

  const [recipientBalance, faucetBalance] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.getBalance({ address: account.address }),
  ]);

  if (recipientBalance >= minBalance) {
    return {
      ok: false,
      status: 400,
      error: `钱包余额已达到 Faucet 门槛（${formatFaucetAmount(minBalance)}），暂时无法领取。`,
    };
  }

  if (faucetBalance < amount) {
    return {
      ok: false,
      status: 503,
      error: "Faucet 钱包余额不足，请稍后再试。",
    };
  }

  return { ok: true };
}

export async function acquireFaucetClaimLock(
  address: `0x${string}`,
  ip: string | null
): Promise<FaucetClaimLock | null> {
  const redis = await getRedis();

  if (!redis) {
    throw new Error("Redis is required for the faucet backend");
  }

  const normalizedIp = normalizeIp(ip);
  const lockSeconds = Math.max(getFaucetCooldownSeconds(), 60);
  const entries = [
    { key: getAddressLockKey(address), token: crypto.randomUUID() },
    ...(normalizedIp ? [{ key: getIpLockKey(normalizedIp), token: crypto.randomUUID() }] : []),
  ];

  const acquired: FaucetClaimLock["entries"] = [];

  for (const entry of entries) {
    const result = await redis.set(entry.key, entry.token, {
      NX: true,
      EX: lockSeconds,
    });

    if (result !== "OK") {
      if (acquired.length > 0) {
        await releaseFaucetClaimLock({ entries: acquired });
      }
      return null;
    }

    acquired.push(entry);
  }

  return { entries: acquired };
}

export async function releaseFaucetClaimLock(lock: FaucetClaimLock) {
  const redis = await getRedis();

  if (!redis) {
    throw new Error("Redis is required for the faucet backend");
  }

  for (const entry of lock.entries) {
    const currentToken = await redis.get(entry.key);

    if (currentToken === entry.token) {
      await redis.del(entry.key);
    }
  }
}

export async function markFaucetClaimed(record: FaucetClaimRecord) {
  const redis = await getRedis();

  if (!redis) {
    throw new Error("Redis is required for the faucet backend");
  }

  const ttl = getFaucetCooldownSeconds();
  const payload = JSON.stringify(record);
  const normalizedIp = normalizeIp(record.ip);

  await redis.set(getAddressClaimKey(record.address), payload, { EX: ttl });

  if (normalizedIp) {
    await redis.set(getIpClaimKey(normalizedIp), payload, { EX: ttl });
  }
}

export function formatFaucetAmount(value: bigint) {
  return `${formatEther(value)} ${knowledgeChain.nativeCurrency.symbol}`;
}
