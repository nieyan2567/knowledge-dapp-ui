import type { PoolClient } from "pg";

import type { ProposalItem } from "@/types/governance";

export async function upsertProposalRow(
  client: PoolClient,
  input: ProposalItem
) {
  await client.query(
    `
      insert into proposal (
        proposal_id,
        proposer_address,
        description,
        state_value,
        vote_start_block,
        vote_end_block,
        eta_second,
        for_vote_amount,
        against_vote_amount,
        abstain_vote_amount,
        created_block_number,
        updated_block_number,
        tx_hash
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      on conflict (proposal_id)
      do update
        set proposer_address = excluded.proposer_address,
            description = excluded.description,
            state_value = excluded.state_value,
            vote_start_block = excluded.vote_start_block,
            vote_end_block = excluded.vote_end_block,
            eta_second = excluded.eta_second,
            for_vote_amount = excluded.for_vote_amount,
            against_vote_amount = excluded.against_vote_amount,
            abstain_vote_amount = excluded.abstain_vote_amount,
            updated_block_number = excluded.updated_block_number,
            tx_hash = excluded.tx_hash,
            update_time = current_timestamp
    `,
    [
      input.proposalId.toString(),
      input.proposer.toLowerCase(),
      input.description,
      input.stateValue?.toString() ?? null,
      input.voteStart.toString(),
      input.voteEnd.toString(),
      input.etaSecond?.toString() ?? null,
      input.votes?.forVotes.toString() ?? "0",
      input.votes?.againstVotes.toString() ?? "0",
      input.votes?.abstainVotes.toString() ?? "0",
      input.blockNumber.toString(),
      input.blockNumber.toString(),
      input.transactionHash ?? null,
    ]
  );
}

export async function replaceProposalActions(
  client: PoolClient,
  proposalId: bigint,
  input: ProposalItem
) {
  await client.query("delete from proposal_action where proposal_id = $1", [
    proposalId.toString(),
  ]);

  for (let index = 0; index < input.targets.length; index += 1) {
    await client.query(
      `
        insert into proposal_action (
          proposal_id,
          action_index,
          target_address,
          action_value,
          calldata_hex
        )
        values ($1, $2, $3, $4, $5)
      `,
      [
        proposalId.toString(),
        index,
        input.targets[index]?.toLowerCase(),
        input.values[index]?.toString() ?? "0",
        input.calldatas[index] ?? "0x",
      ]
    );
  }
}
