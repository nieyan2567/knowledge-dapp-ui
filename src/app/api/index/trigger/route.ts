import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { ensureIndexerEnvLoaded, stringifyWithBigInt } from "@/server/indexer/runtime";
import {
  triggerIndexerSync,
  type IndexerTriggerDomain,
} from "@/server/indexer/trigger";

const triggerSchema = z.object({
  domains: z
    .array(
      z.enum([
        "stake",
        "rewards",
        "content",
        "governance",
        "dashboard",
        "system",
      ])
    )
    .min(1),
  hash: z.string().trim().optional(),
});

export async function POST(request: Request) {
  ensureIndexerEnvLoaded();

  const env = getServerEnv();
  if (!env.INDEXER_ENABLED) {
    return NextResponse.json(
      { error: "Indexer is disabled" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = triggerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid trigger payload",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const result = await triggerIndexerSync(
      parsed.data.domains as IndexerTriggerDomain[]
    );

    return new NextResponse(stringifyWithBigInt({
      ...result,
      hash: parsed.data.hash ?? null,
    }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to trigger indexer sync",
      },
      { status: 500 }
    );
  }
}
