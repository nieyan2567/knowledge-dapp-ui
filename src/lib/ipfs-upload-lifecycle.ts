/**
 * @file IPFS 上传生命周期服务模块。
 * @description 负责上传记录写入、链上登记校验、Kubo 回收以及批量孤儿文件清理。
 */
import "server-only";

import {
  createPublicClient,
  http,
} from "viem";

import { ABIS, CONTRACTS } from "@/contracts";
import { getKnowledgeChain } from "@/lib/chains";
import { getServerEnv } from "@/lib/env";
import {
  runKuboGarbageCollection,
  unpinLocalIpfsCid,
} from "@/lib/ipfs-kubo";
import { asContentData } from "@/lib/web3-types";
import {
  getIpfsUploadRecordById,
  listExpiredIpfsUploadRecords,
  markIpfsUploadCleaned,
  markIpfsUploadCleanupFailed,
  markIpfsUploadRegistered,
  type IpfsUploadRecord,
} from "@/lib/upload-record-store";

/**
 * @notice 单次 CID 清理的执行结果。
 * @dev 用于区分已登记、已清理、清理失败或记录不存在等不同结果。
 */
export type CleanupIpfsUploadOutcome =
  | "missing"
  | "forbidden"
  | "already_registered"
  | "already_cleaned"
  | "marked_registered_by_chain"
  | "cleaned"
  | "failed";

/**
 * @notice 单条上传记录清理报告。
 * @dev 同时返回记录 ID 与 CID，便于前端和系统接口展示处理结果。
 */
export type CleanupIpfsUploadReport = {
  recordId: number;
  cid: string;
  outcome: CleanupIpfsUploadOutcome;
  detail?: string;
  garbageCollected?: boolean;
  gcSkipped?: boolean;
};

function getKnowledgePublicClient() {
  const env = getServerEnv();

  return createPublicClient({
    chain: getKnowledgeChain(),
    transport: http(env.NEXT_PUBLIC_BESU_RPC_URL),
  });
}

/**
 * @notice 检查某个 CID 是否已经被链上内容登记引用。
 * @param cid 待检查的目标 CID。
 * @returns 若链上存在使用该 CID 的内容记录则返回 `true`。
 */
export async function isIpfsCidRegisteredOnChain(cid: string) {
  const contentAddress = CONTRACTS.KnowledgeContent as `0x${string}` | undefined;

  if (!contentAddress) {
    return false;
  }

  const publicClient = getKnowledgePublicClient();
  const total = Number(
    (await publicClient.readContract({
      address: contentAddress,
      abi: ABIS.KnowledgeContent,
      functionName: "contentCount",
    })) ?? 0n
  );

  if (total <= 0) {
    return false;
  }

  const chunkSize = 20;

  for (let start = 0; start < total; start += chunkSize) {
    const ids = Array.from(
      { length: Math.min(chunkSize, total - start) },
      (_, index) => BigInt(start + index + 1)
    );
    const contents = await Promise.all(
      ids.map((id) =>
        publicClient.readContract({
          address: contentAddress,
          abi: ABIS.KnowledgeContent,
          functionName: "contents",
          args: [id],
        })
      )
    );

    for (const item of contents) {
      const content = asContentData(item);
      if (content && !content.deleted && content.ipfsHash === cid) {
        return true;
      }
    }
  }

  return false;
}

/**
 * @notice 对单条上传记录执行孤儿文件清理。
 * @param recordId 目标上传记录 ID。
 * @param reason 本次清理原因说明。
 * @param expectedAddress 可选的预期地址；传入后会阻止非本人清理其他人的记录。
 * @returns 本次清理的执行结果。
 */
export async function cleanupIpfsUploadRecordById(input: {
  recordId: number;
  reason: string;
  expectedAddress?: string;
  runGarbageCollection?: boolean;
}) {
  const record = await getIpfsUploadRecordById(input.recordId);

  if (!record) {
    return {
      recordId: input.recordId,
      cid: "",
      outcome: "missing",
      detail: "upload record not found",
    } satisfies CleanupIpfsUploadReport;
  }

  if (
    input.expectedAddress &&
    record.address.toLowerCase() !== input.expectedAddress.toLowerCase()
  ) {
    return {
      recordId: record.id,
      cid: record.cid,
      outcome: "forbidden",
      detail: "upload record belongs to a different address",
    } satisfies CleanupIpfsUploadReport;
  }

  if (record.status === "registered") {
    return {
      recordId: record.id,
      cid: record.cid,
      outcome: "already_registered",
    } satisfies CleanupIpfsUploadReport;
  }

  if (record.status === "cleaned") {
    return {
      recordId: record.id,
      cid: record.cid,
      outcome: "already_cleaned",
    } satisfies CleanupIpfsUploadReport;
  }

  if (await isIpfsCidRegisteredOnChain(record.cid)) {
    await markIpfsUploadRegistered(record.id, record.registerTxHash);
    return {
      recordId: record.id,
      cid: record.cid,
      outcome: "marked_registered_by_chain",
    } satisfies CleanupIpfsUploadReport;
  }

  try {
    await unpinLocalIpfsCid(record.cid);
    await markIpfsUploadCleaned(record.id, input.reason);
    let garbageCollected = false;
    let gcSkipped = false;

    if (input.runGarbageCollection !== false) {
      const gcReport = await runKuboGarbageCollection();
      garbageCollected = gcReport.triggered;
      gcSkipped = gcReport.skipped;
    }

    return {
      recordId: record.id,
      cid: record.cid,
      outcome: "cleaned",
      garbageCollected,
      gcSkipped,
    } satisfies CleanupIpfsUploadReport;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown cleanup error";
    await markIpfsUploadCleanupFailed(record.id, detail);

    return {
      recordId: record.id,
      cid: record.cid,
      outcome: "failed",
      detail,
    } satisfies CleanupIpfsUploadReport;
  }
}

/**
 * @notice 批量清理已经过期的孤儿上传记录。
 * @param limit 本次最多处理多少条记录。
 * @returns 批量清理报告，包含处理明细与汇总统计。
 */
export async function cleanupExpiredIpfsUploadRecords(limit: number) {
  const records = await listExpiredIpfsUploadRecords(limit);
  const reports: CleanupIpfsUploadReport[] = [];

  for (const record of records) {
    reports.push(
      await cleanupIpfsUploadRecordById({
        recordId: record.id,
        reason: "expired_upload_record",
        runGarbageCollection: false,
      })
    );
  }

  const cleanedCount = reports.filter((item) => item.outcome === "cleaned").length;
  let gcReport:
    | {
        triggered: boolean;
        skipped: boolean;
        reason: "cooldown_active" | "gc_executed";
        detail?: string;
      }
    | undefined;

  if (cleanedCount > 0) {
    gcReport = await runKuboGarbageCollection();
  }

  return {
    total: records.length,
    reports,
    cleanedCount,
    registeredCount: reports.filter(
      (item) => item.outcome === "marked_registered_by_chain"
    ).length,
    failedCount: reports.filter((item) => item.outcome === "failed").length,
    gcReport,
  };
}
