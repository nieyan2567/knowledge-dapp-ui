import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { getIndexedSystemSnapshot } from "@/server/indexer/queries/system";

export async function GET() {
  const env = getServerEnv();

  if (!env.INDEXER_ENABLED) {
    return NextResponse.json({ error: "Indexer is disabled" }, { status: 503 });
  }

  const snapshot = await getIndexedSystemSnapshot();

  if (!snapshot) {
    return NextResponse.json({ error: "System snapshot not found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}
