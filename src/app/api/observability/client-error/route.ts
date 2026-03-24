import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { enforceApiRateLimits } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-validation";
import type { SerializedError } from "@/lib/observability/shared";
import { captureClientErrorReport } from "@/lib/observability/server";

const serializedErrorSchema: z.ZodType<SerializedError> = z.lazy(() =>
  z.object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    code: z.string().optional(),
    cause: serializedErrorSchema.optional(),
  })
);

const clientErrorReportSchema = z.object({
  message: z.string().trim().min(1),
  source: z.string().trim().min(1),
  severity: z.enum(["debug", "info", "warn", "error", "fatal"]).optional(),
  handled: z.boolean().optional(),
  fingerprint: z.string().trim().min(1).optional(),
  tags: z.record(z.string(), z.string()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  error: serializedErrorSchema.optional(),
  pathname: z.string().trim().optional(),
  url: z.string().trim().optional(),
  userAgent: z.string().trim().optional(),
  occurredAt: z.string().trim().optional(),
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimits(req.headers, ["client:error"]);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: rateLimit.error },
      { status: rateLimit.status }
    );
  }

  const bodyResult = await parseJsonBody(
    req,
    clientErrorReportSchema,
    "Invalid client error report payload"
  );

  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const eventId = await captureClientErrorReport(bodyResult.value, {
    request: req,
  });

  return NextResponse.json(
    { accepted: true, eventId },
    {
      status: 202,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
