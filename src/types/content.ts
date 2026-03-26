import type { Address } from "./contracts"

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

export interface ContentVersionData {
  version: bigint
  ipfsHash: string
  title: string
  description: string
  timestamp: bigint
}

export type ContentCardData = ContentData
