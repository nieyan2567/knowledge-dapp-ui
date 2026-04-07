import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { listIndexedContents } from "@/server/indexer/queries/contents";

const contentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(50).optional(),
  author_address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  include_deleted: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export async function GET(request: NextRequest) {
  const env = getServerEnv();

  if (!env.INDEXER_ENABLED) {
    return NextResponse.json(
      { error: "Indexer is disabled" },
      { status: 503 }
    );
  }

  const parsed = contentsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const result = await listIndexedContents(parsed.data);
  return NextResponse.json(result);
}

