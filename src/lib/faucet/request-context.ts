/**
 * @notice Faucet 请求上下文辅助工具。
 * @dev 负责规范化 IP、构造限流键、提取请求来源信息并生成上下文哈希。
 */
import { createHash } from "node:crypto";

import { formatEther } from "viem";

import { getKnowledgeChain } from "@/lib/chains";

/**
 * @notice 规范化 IP 文本。
 * @param ip 原始 IP 字符串。
 * @returns 规整后的小写 IP；若输入为空则返回 `null`。
 */
export function normalizeIp(ip: string | null) {
  const value = ip?.trim();
  return value ? value.toLowerCase() : null;
}

/**
 * @notice 构造按地址维度统计的 Faucet 领取键。
 * @param address 钱包地址。
 * @returns 对应地址的领取记录键。
 */
export function getAddressClaimKey(address: `0x${string}`) {
  return `faucet_claim:address:${address.toLowerCase()}`;
}

/**
 * @notice 构造按 IP 维度统计的 Faucet 领取键。
 * @param ip 规范化后的 IP 字符串。
 * @returns 对应 IP 的领取记录键。
 */
export function getIpClaimKey(ip: string) {
  return `faucet_claim:ip:${ip}`;
}

/**
 * @notice 构造按地址维度统计的 Faucet 锁键。
 * @param address 钱包地址。
 * @returns 对应地址的领取锁键。
 */
export function getAddressLockKey(address: `0x${string}`) {
  return `faucet_lock:address:${address.toLowerCase()}`;
}

/**
 * @notice 构造按 IP 维度统计的 Faucet 锁键。
 * @param ip 规范化后的 IP 字符串。
 * @returns 对应 IP 的领取锁键。
 */
export function getIpLockKey(ip: string) {
  return `faucet_lock:ip:${ip}`;
}

/**
 * @notice 从请求头中提取客户端 IP。
 * @param headers 请求头对象。
 * @returns 请求来源 IP；若无法解析则返回 `null`。
 */
export function getRequestIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return headers.get("x-real-ip");
}

/**
 * @notice 从请求头中提取客户端 User-Agent。
 * @param headers 请求头对象。
 * @returns 若存在则返回原始 User-Agent，否则返回 `"unknown"`。
 */
export function getRequestUserAgent(headers: Headers) {
  const value = headers.get("user-agent")?.trim();
  return value && value.length > 0 ? value : "unknown";
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

/**
 * @notice 为 Faucet 请求生成可记录但不可逆的上下文哈希。
 * @param input 当前请求上下文。
 * @param input.address 钱包地址。
 * @param input.ip 原始客户端 IP。
 * @param input.userAgent 请求 User-Agent。
 * @returns 地址原文与 IP、User-Agent 的哈希结构。
 */
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

/**
 * @notice 格式化 Faucet 发放金额。
 * @param value 发放金额。
 * @returns 带链原生代币符号的金额文本。
 */
export function formatFaucetAmount(value: bigint) {
  return `${formatEther(value)} ${getKnowledgeChain().nativeCurrency.symbol}`;
}
