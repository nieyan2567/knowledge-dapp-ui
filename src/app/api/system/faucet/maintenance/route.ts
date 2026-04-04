import { NextRequest, NextResponse } from "next/server";

import { runFaucetMaintenance } from "@/lib/faucet/utils";
import { captureServerException } from "@/lib/observability/server";
import {
  getSystemApiToken,
  isAuthorizedSystemRequest,
} from "@/lib/system-api-auth";

export const runtime = "nodejs";

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
    const report = await runFaucetMaintenance();

    return NextResponse.json(
      {
        ok: report.status === "ok",
        report,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    await captureServerException("Faucet maintenance failed", {
      source: "api.system.faucet.maintenance",
      severity: "error",
      request: req,
      error,
    });

    return NextResponse.json(
      { error: "Faucet maintenance failed" },
      { status: 500 }
    );
  }
}
