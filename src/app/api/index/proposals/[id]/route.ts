import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { getIndexedProposalById } from "@/server/indexer/queries/proposals";

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
    return NextResponse.json(
      { error: "Indexer is disabled" },
      { status: 503 }
    );
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

  const proposal = await getIndexedProposalById(BigInt(parsed.data.id));

  if (!proposal) {
    return NextResponse.json(
      { error: "Proposal not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    proposal_id: proposal.proposalId.toString(),
    proposer: proposal.proposer,
    description: proposal.description,
    block_number: proposal.blockNumber.toString(),
    vote_start: proposal.voteStart.toString(),
    vote_end: proposal.voteEnd.toString(),
    targets: proposal.targets,
    values: proposal.values.map((value) => value.toString()),
    calldatas: proposal.calldatas,
    transaction_hash: proposal.transactionHash,
    state_value: proposal.stateValue?.toString() ?? null,
    eta_second: proposal.etaSecond?.toString() ?? null,
    for_vote_amount: proposal.votes?.forVotes.toString() ?? "0",
    against_vote_amount: proposal.votes?.againstVotes.toString() ?? "0",
    abstain_vote_amount: proposal.votes?.abstainVotes.toString() ?? "0",
  });
}
