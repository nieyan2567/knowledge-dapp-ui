import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { getIndexedContentById } from "@/server/indexer/queries/contents";

const paramsSchema = z.object({
  id: z.string().trim().regex(/^\d+$/),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const env = getServerEnv();

  if (!env.INDEXER_ENABLED) {
    return NextResponse.json({ error: "Indexer is disabled" }, { status: 503 });
  }

  const parsed = paramsSchema.safeParse(await context.params);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid route parameters",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const result = await getIndexedContentById(BigInt(parsed.data.id));

  if (!result) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
