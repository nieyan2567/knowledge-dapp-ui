import type { PublicClient } from "viem";

import { ABIS, CONTRACTS } from "@/contracts";
import { fetchIndexedProposals } from "@/lib/indexer-api";
import {
  fetchLatestProposal,
  fetchParsedProposals,
  fetchProposalDetail,
  fetchProposalsByProposer,
} from "@/lib/proposal-events";
import { asBigInt, asProposalVotes } from "@/lib/web3-types";
import type { ProposalItem, ProposalVotes } from "@/types/governance";

export async function readProposalListWithFallback(
  publicClient: PublicClient,
  input?: {
    proposerAddress?: `0x${string}`;
  }
): Promise<ProposalItem[]> {
  const indexedProposals = await fetchIndexedProposals(
    input?.proposerAddress
      ? {
          proposer_address: input.proposerAddress,
        }
      : undefined
  );
  if (indexedProposals) {
    return indexedProposals;
  }

  if (input?.proposerAddress) {
    return fetchProposalsByProposer(publicClient, input.proposerAddress);
  }

  return (await fetchParsedProposals(publicClient)).reverse();
}

export async function readLatestProposalWithFallback(
  publicClient: PublicClient
): Promise<ProposalItem | null> {
  const indexedProposals = await fetchIndexedProposals();
  if (indexedProposals) {
    return indexedProposals[0] ?? null;
  }

  return fetchLatestProposal(publicClient);
}

export async function readProposalDetailFromChain(
  publicClient: PublicClient,
  proposalId: bigint
): Promise<{
  detail: ProposalItem | null;
  state: bigint | undefined;
  eta: bigint | undefined;
  votes: ProposalVotes;
}> {
  const detail = await fetchProposalDetail(publicClient, proposalId);
  const [state, votes, proposalEta] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
      abi: ABIS.KnowledgeGovernor,
      functionName: "state",
      args: [proposalId],
    }),
    publicClient.readContract({
      address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
      abi: ABIS.KnowledgeGovernor,
      functionName: "proposalVotes",
      args: [proposalId],
    }),
    publicClient.readContract({
      address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
      abi: ABIS.KnowledgeGovernor,
      functionName: "proposalEta",
      args: [proposalId],
    }),
  ]);

  return {
    detail,
    state: asBigInt(state),
    eta: asBigInt(proposalEta),
    votes:
      asProposalVotes(votes) ?? {
        againstVotes: 0n,
        forVotes: 0n,
        abstainVotes: 0n,
      },
  };
}
