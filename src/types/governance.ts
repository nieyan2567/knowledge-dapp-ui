import type { Address, HexString } from "./contracts"

export type ProposalState =
  | 0 // Pending
  | 1 // Active
  | 2 // Canceled
  | 3 // Defeated
  | 4 // Succeeded
  | 5 // Queued
  | 6 // Expired
  | 7 // Executed

export interface ProposalVotes {
  againstVotes: bigint
  forVotes: bigint
  abstainVotes: bigint
}

export interface ProposalItem {
  proposalId: bigint
  proposer: Address
  description: string
  descriptionHash: HexString
  blockNumber: bigint
  voteStart: bigint
  voteEnd: bigint
  targets: readonly Address[]
  values: readonly bigint[]
  calldatas: readonly HexString[]
	transactionHash?: HexString
}