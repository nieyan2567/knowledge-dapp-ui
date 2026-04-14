import { NextRequest, NextResponse } from "next/server";

import {
  createAdminAddressSchema,
} from "@/lib/admin/schemas";
import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import { captureServerException } from "@/lib/observability/server";
import { requireAdminRequest } from "@/server/admin/auth";
import {
  AdminAddressStoreUnavailableError,
  AdminStoreConflictError,
  createAdminAddress,
  listAdminAddresses,
} from "@/server/admin/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, [
    "admin:admin-addresses:list",
  ]);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: rateLimit.status });
  }

  const authResult = await requireAdminRequest(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const admins = await listAdminAddresses();

    return NextResponse.json(
      {
        currentAddress: authResult.value.address,
        admins,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (error instanceof AdminAddressStoreUnavailableError) {
      return NextResponse.json(
        { error: "管理员名单数据表不可用，请先执行数据库迁移" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    await captureServerException("Failed to list admin addresses", {
      source: "api.admin.admin-addresses.list",
      severity: "error",
      request: req,
      error,
      context: { actorAddress: authResult.value.address },
    });

    return NextResponse.json(
      { error: "管理员名单读取失败，请稍后重试" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, [
    "admin:admin-addresses:create",
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
    createAdminAddressSchema,
    "管理员参数无效"
  );
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  try {
    const admin = await createAdminAddress({
      walletAddress: bodyResult.value.walletAddress,
      remark: bodyResult.value.remark,
      createdBy: authResult.value.address,
    });

    return NextResponse.json(admin, {
      status: 201,
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

    if (error instanceof AdminStoreConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    await captureServerException("Failed to create admin address", {
      source: "api.admin.admin-addresses.create",
      severity: "error",
      request: req,
      error,
      context: {
        actorAddress: authResult.value.address,
        walletAddress: bodyResult.value.walletAddress,
      },
    });

    return NextResponse.json(
      { error: "管理员添加失败，请稍后重试" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
