import type { PublicClient } from "viem";

import { CONTRACTS } from "@/contracts";
import { proposalCreatedEvent } from "@/contracts/events";
import { collectByBlockRange } from "@/lib/block-range";
import { parseProposalCreatedLog } from "@/lib/governance";
import type { ProposalItem } from "@/types/governance";

export async function fetchProposalLogs(publicClient: PublicClient) {
  const latestBlock = await publicClient.getBlockNumber();

  return collectByBlockRange({
    toBlock: latestBlock,
    fetchRange: ({ fromBlock, toBlock }) =>
      publicClient.getLogs({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        event: proposalCreatedEvent,
        fromBlock,
        toBlock,
      }),
  });
}

export async function fetchParsedProposals(publicClient: PublicClient) {
  const logs = await fetchProposalLogs(publicClient);
  return logs.map((log) => parseProposalCreatedLog(log));
}

export async function fetchLatestProposal(publicClient: PublicClient) {
  const proposals = await fetchParsedProposals(publicClient);
  return [...proposals].sort((left, right) => Number(right.blockNumber - left.blockNumber))[0] ?? null;
}

export async function fetchProposalDetail(
  publicClient: PublicClient,
  proposalId: bigint
) {
  const logs = await fetchProposalLogs(publicClient);
  const matched = logs.find((log) => {
    const logProposalId = log.args.proposalId;
    return typeof logProposalId === "bigint" && logProposalId === proposalId;
  });

  return matched ? parseProposalCreatedLog(matched) : null;
}

export async function fetchProposalsByProposer(
  publicClient: PublicClient,
  proposer: `0x${string}`
) {
  const proposals = await fetchParsedProposals(publicClient);
  return proposals
    .filter((proposal) => proposal.proposer.toLowerCase() === proposer.toLowerCase())
    .sort((left, right) => Number(right.blockNumber - left.blockNumber));
}

export function sortProposalsByNewest(proposals: ProposalItem[]) {
  return [...proposals].sort((left, right) => Number(right.blockNumber - left.blockNumber));
}
