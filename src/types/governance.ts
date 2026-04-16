/**
 * @file 治理域类型模块。
 * @description 定义提案、投票、治理模板和编码动作等核心数据结构。
 */
import type { Address, HexString } from "./contracts"

/**
 * @notice Governor 提案状态枚举值。
 * @dev 数值与链上 Governor 合约返回的状态码保持一致。
 */
export type ProposalState =
  | 0 // Pending
  | 1 // Active
  | 2 // Canceled
  | 3 // Defeated
  | 4 // Succeeded
  | 5 // Queued
  | 6 // Expired
  | 7 // Executed

/**
 * @notice 提案投票统计。
 */
export interface ProposalVotes {
  againstVotes: bigint
  forVotes: bigint
  abstainVotes: bigint
}

/**
 * @notice 前端治理页使用的提案实体。
 */
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

/**
 * @notice 单个提案动作的可读摘要。
 * @dev 用于将目标、金额和 calldata 解码成适合界面展示的说明块。
 */
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

/**
 * @notice 治理模板所属业务分类。
 */
export type GovernanceTemplateCategory =
  | "content"
  | "stake"
  | "treasury"
  | "governor"
  | "timelock"

/**
 * @notice 治理动作风险等级。
 */
export type GovernanceRiskLevel = "low" | "medium" | "high"

/**
 * @notice 治理表单字段类型。
 */
export type GovernanceFieldType =
  | "string"
  | "address"
  | "uint256"
  | "tokenAmount"
  | "boolean"
  | "select"

/**
 * @notice 治理模板中的单个表单字段定义。
 */
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

/**
 * @notice 可视化治理模板定义。
 * @dev 描述某类提案动作对应的目标合约、调用函数和表单字段。
 */
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

/**
 * @notice 前端编辑中的治理动作草稿。
 */
export interface GovernanceDraftAction {
  id: string
  templateId: string
  values: Record<string, string | boolean>
}

/**
 * @notice 已编码成链上参数的治理动作。
 */
export interface GovernanceEncodedAction {
  templateId: string
  target: Address
  value: bigint
  calldata: HexString
  title: string
  description: string
  riskLevel: GovernanceRiskLevel
}
