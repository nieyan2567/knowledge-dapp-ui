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
}

export type ContentCardData = ContentData
