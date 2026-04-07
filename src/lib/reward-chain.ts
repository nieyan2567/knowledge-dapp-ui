import type { PublicClient } from "viem";

import { fetchIndexedRewardActivity } from "@/lib/indexer-api";
import {
  fetchRewardActivity,
  type RewardActivityResult,
} from "@/lib/reward-events";

export async function readRewardActivityWithFallback(
  publicClient: PublicClient,
  address?: `0x${string}`
): Promise<RewardActivityResult> {
  const indexedActivity = await fetchIndexedRewardActivity(address);
  if (indexedActivity) {
    return indexedActivity;
  }

  if (!address) {
    return fetchRewardActivity(publicClient);
  }

  return fetchRewardActivity(publicClient, {
    author: address,
    beneficiary: address,
  });
}
