import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { getIndexedRewardActivity } from "@/server/indexer/queries/rewards";

const rewardsQuerySchema = z.object({
  address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/)
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

  const parsed = rewardsQuerySchema.safeParse(
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

  const result = await getIndexedRewardActivity({
    address: parsed.data.address as `0x${string}` | undefined,
  });

  return NextResponse.json({
    historyItems: result.historyItems.map((item) => ({
      ...item,
      amount: item.amount.toString(),
      blockNumber: item.blockNumber.toString(),
      timestamp: item.timestamp?.toString(),
      contentId: item.contentId?.toString(),
    })),
    rewardSources: result.rewardSources.map((item) => ({
      ...item,
      contentId: item.contentId.toString(),
      totalAmount: item.totalAmount.toString(),
      latestBlock: item.latestBlock.toString(),
    })),
  });
}
