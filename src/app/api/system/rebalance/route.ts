import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { rebalanceRevenueVault } from "@/lib/faucet/utils";
import { captureServerException } from "@/lib/observability/server";

export const runtime = "nodejs";

function readBearerToken(req: NextRequest) {
  const authorization = req.headers.get("authorization")?.trim();
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function safeTokenEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(req: NextRequest) {
  const token = getServerEnv().REBALANCE_API_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "Rebalance API token is not configured" },
      { status: 503 }
    );
  }

  const providedToken = readBearerToken(req);
  if (!providedToken || !safeTokenEquals(providedToken, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const txHash = await rebalanceRevenueVault();

    if (!txHash) {
      return NextResponse.json(
        { error: "RevenueVault is not available" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        txHash,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    await captureServerException("System rebalance failed", {
      source: "api.system.rebalance",
      severity: "error",
      request: req,
      error,
    });

    return NextResponse.json(
      { error: "System rebalance failed" },
      { status: 500 }
    );
  }
}
