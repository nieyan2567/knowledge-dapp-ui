import { createHash } from "node:crypto";

import { formatEther } from "viem";

import { getKnowledgeChain } from "@/lib/chains";

export function normalizeIp(ip: string | null) {
  const value = ip?.trim();
  return value ? value.toLowerCase() : null;
}

export function getAddressClaimKey(address: `0x${string}`) {
  return `faucet_claim:address:${address.toLowerCase()}`;
}

export function getIpClaimKey(ip: string) {
  return `faucet_claim:ip:${ip}`;
}

export function getAddressLockKey(address: `0x${string}`) {
  return `faucet_lock:address:${address.toLowerCase()}`;
}

export function getIpLockKey(ip: string) {
  return `faucet_lock:ip:${ip}`;
}

export function getRequestIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return headers.get("x-real-ip");
}

export function getRequestUserAgent(headers: Headers) {
  const value = headers.get("user-agent")?.trim();
  return value && value.length > 0 ? value : "unknown";
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function createRequestContextHashes(input: {
  address: `0x${string}`;
  ip: string | null;
  userAgent: string;
}) {
  return {
    address: input.address,
    ipHash: hashValue(normalizeIp(input.ip) ?? "unknown"),
    userAgentHash: hashValue(input.userAgent.trim() || "unknown"),
  };
}

export function formatFaucetAmount(value: bigint) {
  return `${formatEther(value)} ${getKnowledgeChain().nativeCurrency.symbol}`;
}
