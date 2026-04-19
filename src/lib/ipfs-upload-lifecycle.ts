/**
 * @file IPFS 上传生命周期服务模块。
 * @description 负责孤儿上传清理、软删除宽限期调度，以及按整条内容批量清理全部版本文件。
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
  cancelSoftDeleteForContent,
  getIpfsUploadRecordById,
  listDueSoftDeletedContentIds,
  listExpiredIpfsUploadRecords,
  listIpfsUploadRecordsByContentId,
  markIpfsUploadCleaned,
  markIpfsUploadCleanupFailed,
  markIpfsUploadRegistered,
  scheduleSoftDeleteForContent,
} from "@/lib/upload-record-store";

export type CleanupIpfsUploadOutcome =
  | "missing"
  | "forbidden"
  | "already_registered"
  | "already_cleaned"
  | "marked_registered_by_chain"
  | "cleaned"
  | "failed";

export type CleanupIpfsUploadReport = {
  recordId: number;
  cid: string;
  outcome: CleanupIpfsUploadOutcome;
  detail?: string;
  garbageCollected?: boolean;
  gcSkipped?: boolean;
};

export type SoftDeletedContentCleanupOutcome =
  | "cleaned"
  | "restored"
  | "nothing_to_clean"
  | "failed";

export type SoftDeletedContentCleanupReport = {
  contentId: string;
  outcome: SoftDeletedContentCleanupOutcome;
  cleanedRecordCount: number;
  cleanedCidCount: number;
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

export async function readContentDeletedState(contentId: bigint) {
  const contentAddress = CONTRACTS.KnowledgeContent as `0x${string}` | undefined;

  if (!contentAddress) {
    return null;
  }

  const publicClient = getKnowledgePublicClient();
  const raw = await publicClient.readContract({
    address: contentAddress,
    abi: ABIS.KnowledgeContent,
    functionName: "contents",
    args: [contentId],
  });
  const content = asContentData(raw);

  return content?.deleted ?? null;
}

export async function scheduleSoftDeletedContentCleanup(contentId: bigint) {
  const retentionSeconds = getServerEnv().CONTENT_SOFT_DELETE_RETENTION_SECONDS;
  const deletedAt = new Date();
  const scheduledAt = new Date(deletedAt.getTime() + retentionSeconds * 1000);

  await scheduleSoftDeleteForContent(contentId, scheduledAt, deletedAt);

  return {
    contentId,
    deletedAt,
    scheduledAt,
  };
}

export async function cancelSoftDeletedContentCleanup(contentId: bigint) {
  await cancelSoftDeleteForContent(contentId);
}

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
    await markIpfsUploadRegistered(record.id, {
      txHash: record.registerTxHash,
      contentId: record.contentId,
      versionNumber: record.versionNumber,
    });
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

export async function cleanupSoftDeletedContentById(input: {
  contentId: bigint;
  reason: string;
  runGarbageCollection?: boolean;
}) {
  const records = await listIpfsUploadRecordsByContentId(input.contentId);

  if (records.length === 0) {
    return {
      contentId: input.contentId.toString(),
      outcome: "nothing_to_clean",
      cleanedRecordCount: 0,
      cleanedCidCount: 0,
      detail: "no upload records bound to this content",
    } satisfies SoftDeletedContentCleanupReport;
  }

  const isDeleted = await readContentDeletedState(input.contentId);

  if (!isDeleted) {
    await cancelSoftDeleteForContent(input.contentId);
    return {
      contentId: input.contentId.toString(),
      outcome: "restored",
      cleanedRecordCount: 0,
      cleanedCidCount: 0,
      detail: "content has already been restored on-chain",
    } satisfies SoftDeletedContentCleanupReport;
  }

  const pendingRecords = records.filter((record) => !record.purgedAt);

  if (pendingRecords.length === 0) {
    return {
      contentId: input.contentId.toString(),
      outcome: "nothing_to_clean",
      cleanedRecordCount: 0,
      cleanedCidCount: 0,
      detail: "all version files have already been purged",
    } satisfies SoftDeletedContentCleanupReport;
  }

  const byCid = new Map<string, typeof pendingRecords>();
  for (const record of pendingRecords) {
    const list = byCid.get(record.cid) ?? [];
    list.push(record);
    byCid.set(record.cid, list);
  }

  let cleanedRecordCount = 0;
  let cleanedCidCount = 0;

  try {
    for (const [cid, groupedRecords] of byCid.entries()) {
      await unpinLocalIpfsCid(cid);
      cleanedCidCount += 1;

      for (const record of groupedRecords) {
        await markIpfsUploadCleaned(record.id, input.reason);
        cleanedRecordCount += 1;
      }
    }

    let garbageCollected = false;
    let gcSkipped = false;

    if (input.runGarbageCollection !== false) {
      const gcReport = await runKuboGarbageCollection();
      garbageCollected = gcReport.triggered;
      gcSkipped = gcReport.skipped;
    }

    return {
      contentId: input.contentId.toString(),
      outcome: "cleaned",
      cleanedRecordCount,
      cleanedCidCount,
      garbageCollected,
      gcSkipped,
    } satisfies SoftDeletedContentCleanupReport;
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "unknown soft-delete cleanup error";

    for (const record of pendingRecords) {
      await markIpfsUploadCleanupFailed(record.id, detail);
    }

    return {
      contentId: input.contentId.toString(),
      outcome: "failed",
      cleanedRecordCount,
      cleanedCidCount,
      detail,
    } satisfies SoftDeletedContentCleanupReport;
  }
}

export async function cleanupDueSoftDeletedContents(limit: number) {
  const contentIds = await listDueSoftDeletedContentIds(limit);
  const reports: SoftDeletedContentCleanupReport[] = [];

  for (const contentId of contentIds) {
    reports.push(
      await cleanupSoftDeletedContentById({
        contentId,
        reason: "soft_deleted_content_retention_elapsed",
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
    total: contentIds.length,
    reports,
    cleanedCount,
    restoredCount: reports.filter((item) => item.outcome === "restored").length,
    failedCount: reports.filter((item) => item.outcome === "failed").length,
    gcReport,
  };
}
