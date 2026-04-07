import { NextResponse } from "next/server";

import { getContentIndexHealth } from "@/server/indexer/handlers/content";
import { getProposalIndexHealth } from "@/server/indexer/handlers/proposal";
import { getRewardIndexHealth } from "@/server/indexer/handlers/reward";
import { getStakeIndexHealth } from "@/server/indexer/handlers/stake";
import { getSystemIndexHealth } from "@/server/indexer/handlers/system";

export async function GET() {
  const [content, proposal, reward, stake, system] = await Promise.all([
    getContentIndexHealth(),
    getProposalIndexHealth(),
    getRewardIndexHealth(),
    getStakeIndexHealth(),
    getSystemIndexHealth(),
  ]);

  return NextResponse.json({
    content,
    proposal,
    reward,
    stake,
    system,
  });
}
