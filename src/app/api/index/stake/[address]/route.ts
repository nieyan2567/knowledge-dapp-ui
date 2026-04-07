import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { getIndexedStakeSummary } from "@/server/indexer/queries/stake";

type RouteContext = {
  params: Promise<{
    address: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const env = getServerEnv();

  if (!env.INDEXER_ENABLED) {
    return NextResponse.json(
      { error: "Indexer is disabled" },
      { status: 503 }
    );
  }

  const { address } = await context.params;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid address" },
      { status: 400 }
    );
  }

  const result = await getIndexedStakeSummary(address);
  return NextResponse.json(result);
}
