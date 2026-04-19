/**
 * @file Kubo 访问辅助模块。
 * @description 负责构造本地 Kubo API 请求，并提供 pin/rm、repo/gc 等轻量封装。
 */
import "server-only";

import { getServerEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";

type KuboGcReport = {
  triggered: boolean;
  skipped: boolean;
  reason: "cooldown_active" | "gc_executed";
  detail?: string;
};

type GcCooldownStore = {
  expiresAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __knowledgeIpfsGcCooldown: GcCooldownStore | undefined;
}

const IPFS_GC_COOLDOWN_KEY = "ipfs:gc:cooldown";

/**
 * @notice 读取并规范化当前 Kubo API 地址。
 * @returns 去除尾部斜杠后的 Kubo API 根地址。
 */
export function getKuboApiUrl() {
  return getServerEnv().IPFS_API_URL.replace(/\/+$/, "");
}

async function acquireIpfsGcCooldownLock() {
  const cooldownSeconds = getServerEnv().IPFS_GC_COOLDOWN_SECONDS;
  const redis = await getRedis();

  if (redis) {
    const acquired = await redis.set(IPFS_GC_COOLDOWN_KEY, String(Date.now()), {
      NX: true,
      EX: cooldownSeconds,
    });

    if (!acquired) {
      return false;
    }

    return true;
  }

  const now = Date.now();
  const existing = globalThis.__knowledgeIpfsGcCooldown;

  if (existing && existing.expiresAt > now) {
    return false;
  }

  globalThis.__knowledgeIpfsGcCooldown = {
    expiresAt: now + cooldownSeconds * 1000,
  };

  return true;
}

async function releaseIpfsGcCooldownLock() {
  const redis = await getRedis();

  if (redis) {
    await redis.del(IPFS_GC_COOLDOWN_KEY);
    return;
  }

  globalThis.__knowledgeIpfsGcCooldown = undefined;
}

/**
 * @notice 调用本地 Kubo 取消 pin。
 * @param cid 待回收的目标 CID。
 * @returns 无返回值；若 Kubo 拒绝请求则抛出异常。
 */
export async function unpinLocalIpfsCid(cid: string) {
  const response = await fetch(
    `${getKuboApiUrl()}/api/v0/pin/rm?arg=${encodeURIComponent(cid)}`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Kubo pin/rm failed");
  }
}

/**
 * @notice 触发本地 Kubo 的仓库垃圾回收。
 * @returns 返回本次是否执行 GC 以及是否因冷却时间跳过。
 */
export async function runKuboGarbageCollection(): Promise<KuboGcReport> {
  const canRun = await acquireIpfsGcCooldownLock();

  if (!canRun) {
    return {
      triggered: false,
      skipped: true,
      reason: "cooldown_active",
    };
  }

  try {
    const response = await fetch(`${getKuboApiUrl()}/api/v0/repo/gc?stream-errors=true`, {
      method: "POST",
    });

    const detail = await response.text();

    if (!response.ok) {
      await releaseIpfsGcCooldownLock();
      throw new Error(detail || "Kubo repo/gc failed");
    }

    return {
      triggered: true,
      skipped: false,
      reason: "gc_executed",
      detail,
    };
  } catch (error) {
    await releaseIpfsGcCooldownLock();
    throw error;
  }
}
