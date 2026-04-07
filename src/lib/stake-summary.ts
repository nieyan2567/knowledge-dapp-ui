import type { PublicClient } from "viem";

import { ABIS, CONTRACTS } from "@/contracts";

export type StakeSummaryData = {
  vote_amount: bigint;
  staked_amount: bigint;
  pending_stake_amount: bigint;
  pending_withdraw_amount: bigint;
  activate_after_block: bigint;
  withdraw_after_time: bigint;
};

export async function readStakeSummaryFromChain(
  publicClient: PublicClient,
  address: `0x${string}`
) {
  const [
    voteAmount,
    stakedAmount,
    pendingStakeAmount,
    pendingWithdrawAmount,
    activateAfterBlock,
    withdrawAfterTime,
  ] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "getVotes",
      args: [address],
    }),
    publicClient.readContract({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "staked",
      args: [address],
    }),
    publicClient.readContract({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "pendingStake",
      args: [address],
    }),
    publicClient.readContract({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "pendingWithdraw",
      args: [address],
    }),
    publicClient.readContract({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "activateAfterBlock",
      args: [address],
    }),
    publicClient.readContract({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "withdrawAfterTime",
      args: [address],
    }),
  ]);

  return {
    vote_amount: voteAmount as bigint,
    staked_amount: stakedAmount as bigint,
    pending_stake_amount: pendingStakeAmount as bigint,
    pending_withdraw_amount: pendingWithdrawAmount as bigint,
    activate_after_block: activateAfterBlock as bigint,
    withdraw_after_time: withdrawAfterTime as bigint,
  } satisfies StakeSummaryData;
}
