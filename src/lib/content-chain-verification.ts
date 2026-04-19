/**
 * @file 内容链上交易验证模块。
 * @description 负责根据交易哈希读取回执，并从日志中解析内容注册、更新、删除和恢复事件。
 */
import "server-only";

import {
  createPublicClient,
  decodeEventLog,
  http,
} from "viem";

import { ABIS, CONTRACTS } from "@/contracts";
import { getKnowledgeChain } from "@/lib/chains";
import { getServerEnv } from "@/lib/env";

type RegisterOrUpdateKind = "register" | "update";
type LifecycleActionKind = "delete" | "restore";

function readBigIntEventArg(
  args: unknown,
  name: string,
  position: number
): bigint | null {
  if (!args) {
    return null;
  }

  if (Array.isArray(args)) {
    const value = args[position];
    return typeof value === "bigint" ? value : null;
  }

  if (typeof args === "object" && args !== null) {
    const value = (args as Record<string, unknown>)[name];
    return typeof value === "bigint" ? value : null;
  }

  return null;
}

function getKnowledgePublicClient() {
  return createPublicClient({
    chain: getKnowledgeChain(),
    transport: http(getServerEnv().NEXT_PUBLIC_BESU_RPC_URL),
  });
}

export async function readSuccessfulTransactionReceipt(txHash: `0x${string}`) {
  const publicClient = getKnowledgePublicClient();
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    throw new Error("Transaction receipt status is not success");
  }

  return receipt;
}

export async function readVerifiedContentMutationFromTx(input: {
  txHash: `0x${string}`;
  kind: RegisterOrUpdateKind;
}) {
  const receipt = await readSuccessfulTransactionReceipt(input.txHash);

  let contentId: bigint | null = null;
  let versionNumber: bigint | null = null;

  for (const log of receipt.logs) {
    if (
      !log.address ||
      log.address.toLowerCase() !==
        String(CONTRACTS.KnowledgeContent).toLowerCase()
    ) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: ABIS.KnowledgeContent,
        data: log.data,
        topics: log.topics,
      });

      if (input.kind === "register" && decoded.eventName === "ContentRegistered") {
        const registeredContentId = readBigIntEventArg(decoded.args, "id", 0);
        if (registeredContentId !== null) {
          contentId = registeredContentId;
        }
      }

      if (input.kind === "update" && decoded.eventName === "ContentUpdated") {
        const updatedContentId = readBigIntEventArg(decoded.args, "id", 0);
        if (updatedContentId !== null) {
          contentId = updatedContentId;
        }
      }

      if (decoded.eventName === "ContentVersionStored") {
        const versionContentId = readBigIntEventArg(decoded.args, "id", 0);
        const storedVersionNumber = readBigIntEventArg(decoded.args, "version", 1);

        if (
          versionContentId !== null &&
          storedVersionNumber !== null &&
          (!contentId || versionContentId === contentId)
        ) {
          contentId = versionContentId;
          versionNumber = storedVersionNumber;
        }
      }
    } catch {
      // 忽略非目标事件日志。
    }
  }

  if (!contentId) {
    throw new Error(`Unable to resolve content ID from ${input.kind} transaction receipt`);
  }

  return {
    contentId,
    versionNumber: versionNumber ?? (input.kind === "register" ? 1n : null),
  };
}

export async function verifyContentLifecycleTx(input: {
  txHash: `0x${string}`;
  contentId: bigint;
  action: LifecycleActionKind;
}) {
  const receipt = await readSuccessfulTransactionReceipt(input.txHash);
  const expectedEventName =
    input.action === "delete" ? "ContentDeleted" : "ContentRestored";

  for (const log of receipt.logs) {
    if (
      !log.address ||
      log.address.toLowerCase() !==
        String(CONTRACTS.KnowledgeContent).toLowerCase()
    ) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: ABIS.KnowledgeContent,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== expectedEventName) {
        continue;
      }

      const eventContentId = readBigIntEventArg(decoded.args, "id", 0);
      if (eventContentId === input.contentId) {
        return true;
      }
    } catch {
      // 忽略非目标事件日志。
    }
  }

  return false;
}
