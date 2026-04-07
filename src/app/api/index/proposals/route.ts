import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { listIndexedProposals } from "@/server/indexer/queries/proposals";

const proposalsQuerySchema = z.object({
  proposer_address: z
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

  const parsed = proposalsQuerySchema.safeParse(
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

  const proposals = await listIndexedProposals({
    proposer_address: parsed.data.proposer_address as `0x${string}` | undefined,
  });
  return NextResponse.json(
    proposals.map((proposal) => ({
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
    }))
  );
}
