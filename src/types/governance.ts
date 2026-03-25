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

export interface ProposalActionSummary {
  target: Address
  targetLabel: string
  value: bigint
  functionName: string
  title: string
  description: string
  details?: Array<{ label: string; value: string }>
  rawCalldata: HexString
}

export type GovernanceTemplateCategory =
  | "content"
  | "treasury"
  | "governor"
  | "timelock"

export type GovernanceRiskLevel = "low" | "medium" | "high"

export type GovernanceFieldType =
  | "string"
  | "address"
  | "uint256"
  | "tokenAmount"
  | "boolean"
  | "select"

export interface GovernanceTemplateField {
  key: string
  label: string
  type: GovernanceFieldType
  required: boolean
  description?: string
  placeholder?: string
  defaultValue?: string | boolean
  options?: Array<{ label: string; value: string }>
}

export interface GovernanceTemplateDefinition {
  id: string
  category: GovernanceTemplateCategory
  label: string
  description: string
  riskLevel: GovernanceRiskLevel
  target: Address
  functionName: string
  valueMode: "fixedZero" | "optionalNativeValue"
  fields: GovernanceTemplateField[]
}

export interface GovernanceDraftAction {
  id: string
  templateId: string
  values: Record<string, string | boolean>
}

export interface GovernanceEncodedAction {
  templateId: string
  target: Address
  value: bigint
  calldata: HexString
  title: string
  description: string
  riskLevel: GovernanceRiskLevel
}
