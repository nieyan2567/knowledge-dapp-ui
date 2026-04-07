import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { listIndexedProposals } from "@/server/indexer/queries/proposals";

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

  const proposals = await listIndexedProposals({
    proposer_address: address as `0x${string}`,
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
    }))
  );
}

