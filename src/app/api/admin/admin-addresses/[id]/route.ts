import { NextRequest, NextResponse } from "next/server";

import { updateAdminAddressSchema } from "@/lib/admin/schemas";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { captureServerException } from "@/lib/observability/server";
import { requireAdminRequest } from "@/server/admin/auth";
import {
  AdminAddressStoreUnavailableError,
  AdminStoreConflictError,
  AdminStoreNotFoundError,
  updateAdminAddress,
} from "@/server/admin/store";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rateLimit = await enforceApiRateLimits(req.headers, [
    "admin:admin-addresses:update",
  ]);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });
  }

  const authResult = await requireAdminRequest(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(
    req,
    updateAdminAddressSchema,
    "管理员更新参数无效"
  );
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const { id } = await context.params;

  try {
    const admin = await updateAdminAddress({
      id,
      isActive: bodyResult.value.isActive,
      remark: bodyResult.value.remark,
    });

    return NextResponse.json(admin, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AdminAddressStoreUnavailableError) {
      return NextResponse.json(
        { error: "管理员名单数据表不可用，请先执行数据库迁移" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (error instanceof AdminStoreNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (error instanceof AdminStoreConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    await captureServerException("Failed to update admin address", {
      source: "api.admin.admin-addresses.update",
      severity: "error",
      request: req,
      error,
      context: { actorAddress: authResult.value.address, adminAddressId: id },
    });

    return NextResponse.json(
      { error: "管理员更新失败，请稍后重试" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
