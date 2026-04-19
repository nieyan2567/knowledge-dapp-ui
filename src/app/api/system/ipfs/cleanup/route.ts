import { NextRequest, NextResponse } from "next/server";

/**
 * 模块说明：系统级 IPFS 清理接口，供受信任运维方批量回收已过期且未登记的孤儿文件。
 */
import {
  cleanupDueSoftDeletedContents,
  cleanupExpiredIpfsUploadRecords,
} from "@/lib/ipfs-upload-lifecycle";
import { captureServerException } from "@/lib/observability/server";
import {
  getSystemApiToken,
  isAuthorizedSystemRequest,
} from "@/lib/system-api-auth";
import { getServerEnv } from "@/lib/env";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

/**
 * 批量清理已过期的上传记录。
 * @param req 携带系统 Bearer Token 的请求对象。
 * @returns 返回本次清理批次报告的 JSON 响应。
 */
export async function POST(req: NextRequest) {
  const token = getSystemApiToken();

  if (!token) {
    return NextResponse.json(
      { error: "System API token is not configured" },
      { status: 503 }
    );
  }

  if (!isAuthorizedSystemRequest(req, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orphanReport = await cleanupExpiredIpfsUploadRecords(
      getServerEnv().UPLOAD_CLEANUP_BATCH_SIZE
    );
    const softDeletedContentReport = await cleanupDueSoftDeletedContents(
      getServerEnv().UPLOAD_CLEANUP_BATCH_SIZE
    );

    return NextResponse.json(
      {
        ok:
          orphanReport.failedCount === 0 &&
          softDeletedContentReport.failedCount === 0,
        report: {
          orphanUploads: orphanReport,
          softDeletedContents: softDeletedContentReport,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    await captureServerException("System IPFS cleanup failed", {
      source: "api.system.ipfs.cleanup",
      severity: "error",
      request: req,
      error,
    });

    return NextResponse.json(
      { error: "System IPFS cleanup failed" },
      { status: 500 }
    );
  }
}
