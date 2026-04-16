/**
 * @file 内容域类型模块。
 * @description 定义内容列表、版本记录和卡片展示所需的数据结构。
 */
import type { Address } from "./contracts"

/**
 * @notice 内容合约中的基础内容记录。
 * @dev 对应前端列表页和详情页常用的内容元数据。
 */
export interface ContentData {
  id: bigint
  author: Address
  ipfsHash: string
  title: string
  description: string
  voteCount: bigint
  timestamp: bigint
  rewardAccrued: boolean
  deleted: boolean
  latestVersion: bigint
  lastUpdatedAt: bigint
}

/**
 * @notice 单个内容版本的快照数据。
 */
export interface ContentVersionData {
  version: bigint
  ipfsHash: string
  title: string
  description: string
  timestamp: bigint
}

/**
 * @notice 内容卡片展示数据。
 * @dev 在基础内容数据上补充奖励累计次数等列表页派生字段。
 */
export type ContentCardData = ContentData & {
  rewardAccrualCount: bigint
}
