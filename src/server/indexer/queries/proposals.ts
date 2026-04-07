import { keccak256, stringToBytes, toHex } from "viem";

import type { ProposalItem } from "@/types/governance";

import { getIndexerPool } from "../db";

type ProposalRow = {
  proposal_id: string;
  proposer_address: string;
  description: string;
  state_value: string | null;
  created_block_number: string;
  tx_hash: string | null;
  vote_start_block: string | null;
  vote_end_block: string | null;
  eta_second: string | null;
  for_vote_amount: string;
  against_vote_amount: string;
  abstain_vote_amount: string;
};

type ProposalActionRow = {
  proposal_id: string;
  action_index: string;
  target_address: string;
  action_value: string;
  calldata_hex: string;
};

function normalizeProposalId(value: string) {
  return value.trim();
}

function mapProposalRowToItem(
  row: ProposalRow,
  actionRows: ProposalActionRow[]
): ProposalItem {
  const sortedActions = [...actionRows].sort(
    (left, right) => Number(left.action_index) - Number(right.action_index)
  );

  return {
    proposalId: BigInt(normalizeProposalId(row.proposal_id)),
    proposer: row.proposer_address.trim().toLowerCase() as `0x${string}`,
    description: row.description,
    descriptionHash: keccak256(toHex(stringToBytes(row.description))),
    blockNumber: BigInt(row.created_block_number),
    voteStart: BigInt(row.vote_start_block ?? "0"),
    voteEnd: BigInt(row.vote_end_block ?? "0"),
    targets: sortedActions.map(
      (action) => action.target_address.trim().toLowerCase() as `0x${string}`
    ),
    values: sortedActions.map((action) => BigInt(action.action_value)),
    calldatas: sortedActions.map(
      (action) => action.calldata_hex.trim() as `0x${string}`
    ),
    transactionHash: row.tx_hash?.trim() as `0x${string}` | undefined,
    stateValue: row.state_value ? BigInt(row.state_value) : undefined,
    etaSecond: row.eta_second ? BigInt(row.eta_second) : undefined,
    votes: {
      againstVotes: BigInt(row.against_vote_amount),
      forVotes: BigInt(row.for_vote_amount),
      abstainVotes: BigInt(row.abstain_vote_amount),
    },
  };
}

export async function listIndexedProposals(input?: {
  proposer_address?: `0x${string}`;
}) {
  const pool = getIndexerPool();
  const values: string[] = [];
  const where: string[] = [];

  if (input?.proposer_address) {
    values.push(input.proposer_address.toLowerCase());
    where.push(`lower(proposer_address) = $${values.length}`);
  }

  const whereClause = where.length > 0 ? `where ${where.join(" and ")}` : "";
  const proposalResult = await pool.query<ProposalRow>(
    `
      select
        btrim(proposal_id) as proposal_id,
        btrim(proposer_address) as proposer_address,
        description,
        state_value::text as state_value,
        created_block_number::text as created_block_number,
        nullif(btrim(tx_hash), '') as tx_hash,
        vote_start_block::text as vote_start_block,
        vote_end_block::text as vote_end_block,
        eta_second::text as eta_second,
        for_vote_amount::text as for_vote_amount,
        against_vote_amount::text as against_vote_amount,
        abstain_vote_amount::text as abstain_vote_amount
      from proposal
      ${whereClause}
      order by created_block_number desc
    `,
    values
  );

  if (proposalResult.rows.length === 0) {
    return [] satisfies ProposalItem[];
  }

  const actionResult = await pool.query<ProposalActionRow>(
    `
      select
        btrim(proposal_id) as proposal_id,
        action_index::text as action_index,
        btrim(target_address) as target_address,
        action_value::text as action_value,
        calldata_hex
      from proposal_action
      where proposal_id = any($1)
      order by proposal_id asc, action_index asc
    `,
    [proposalResult.rows.map((row) => row.proposal_id)]
  );

  const actionMap = new Map<string, ProposalActionRow[]>();

  for (const row of actionResult.rows) {
    const items = actionMap.get(row.proposal_id) ?? [];
    items.push(row);
    actionMap.set(row.proposal_id, items);
  }

  return proposalResult.rows.map((row) =>
    mapProposalRowToItem(row, actionMap.get(row.proposal_id) ?? [])
  );
}

export async function getIndexedProposalById(proposalId: bigint) {
  const pool = getIndexerPool();
  const normalizedProposalId = proposalId.toString();

  const proposalResult = await pool.query<ProposalRow>(
    `
      select
        btrim(proposal_id) as proposal_id,
        btrim(proposer_address) as proposer_address,
        description,
        state_value::text as state_value,
        created_block_number::text as created_block_number,
        nullif(btrim(tx_hash), '') as tx_hash,
        vote_start_block::text as vote_start_block,
        vote_end_block::text as vote_end_block,
        eta_second::text as eta_second,
        for_vote_amount::text as for_vote_amount,
        against_vote_amount::text as against_vote_amount,
        abstain_vote_amount::text as abstain_vote_amount
      from proposal
      where proposal_id = $1
      limit 1
    `,
    [normalizedProposalId]
  );

  const proposalRow = proposalResult.rows[0];

  if (!proposalRow) {
    return null;
  }

  const actionResult = await pool.query<ProposalActionRow>(
    `
      select
        btrim(proposal_id) as proposal_id,
        action_index::text as action_index,
        btrim(target_address) as target_address,
        action_value::text as action_value,
        calldata_hex
      from proposal_action
      where proposal_id = $1
      order by action_index asc
    `,
    [normalizedProposalId]
  );

  return mapProposalRowToItem(proposalRow, actionResult.rows);
}
