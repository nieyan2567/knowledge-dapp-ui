import { NextRequest, NextResponse } from "next/server";

/**
 * @file 内容生命周期回写接口。
 * @description 在软删除和恢复交易确认后，验证链上事件并为整条内容安排或取消延迟清理。
 */
import { contentLifecycleBodySchema } from "@/lib/api-schemas";
import { errorResponse, parseJsonBody } from "@/lib/api-validation";
import { verifyContentLifecycleTx } from "@/lib/content-chain-verification";
import {
  cancelSoftDeletedContentCleanup,
  scheduleSoftDeletedContentCleanup,
} from "@/lib/ipfs-upload-lifecycle";
import { captureServerException } from "@/lib/observability/server";
import { getContentStorageLifecycleSummary } from "@/lib/upload-record-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const contentIdParam = req.nextUrl.searchParams.get("contentId");

  if (!contentIdParam || !/^\d+$/.test(contentIdParam)) {
    return errorResponse("内容 ID 格式无效", 400);
  }

  try {
    const summary = await getContentStorageLifecycleSummary(BigInt(contentIdParam));

    return NextResponse.json({
      ok: true,
      summary: summary
        ? {
            contentId: summary.contentId.toString(),
            totalRecords: summary.totalRecords,
            purgedCount: summary.purgedCount,
            hasPendingPurge: summary.hasPendingPurge,
            scheduledAt: summary.scheduledAt?.toISOString() ?? null,
            fullyPurged: summary.fullyPurged,
          }
        : null,
    });
  } catch (error) {
    await captureServerException("Failed to read content lifecycle summary", {
      source: "api.ipfs.content_lifecycle",
      severity: "error",
      request: req,
      error,
    });

    return errorResponse("内容生命周期状态读取失败", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await parseJsonBody(
    req,
    contentLifecycleBodySchema,
    "内容生命周期回写请求格式无效"
  );

  if (!body.ok) {
    return body.response;
  }

  const contentId = BigInt(body.value.contentId);

  try {
    const verified = await verifyContentLifecycleTx({
      txHash: body.value.txHash as `0x${string}`,
      contentId,
      action: body.value.action,
    });

    if (!verified) {
      return errorResponse("链上交易与目标内容状态不匹配", 400);
    }

    if (body.value.action === "delete") {
      const schedule = await scheduleSoftDeletedContentCleanup(contentId);
      return NextResponse.json({
        ok: true,
        action: "delete",
        contentId: contentId.toString(),
        deletedAt: schedule.deletedAt.toISOString(),
        scheduledAt: schedule.scheduledAt.toISOString(),
      });
    }

    await cancelSoftDeletedContentCleanup(contentId);
    return NextResponse.json({
      ok: true,
      action: "restore",
      contentId: contentId.toString(),
    });
  } catch (error) {
    await captureServerException("Failed to update content lifecycle state", {
      source: "api.ipfs.content_lifecycle",
      severity: "error",
      request: req,
      error,
      context: {
        contentId: contentId.toString(),
        action: body.value.action,
      },
    });

    return errorResponse("内容生命周期状态更新失败", 500);
  }
}
