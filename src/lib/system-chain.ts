import type { PublicClient } from "viem";

import { ABIS, CONTRACTS } from "@/contracts";
import { asBigInt } from "@/lib/web3-types";

export type SystemSnapshotChainData = {
  contentOwner: string;
  votesContract: string;
  treasuryContract: string;
  editLockVotes: bigint;
  allowDeleteAfterVote: boolean;
  maxVersionsPerContent: bigint;
  treasuryOwner: string;
  epochBudget: bigint;
  epochSpent: bigint;
  minDelay: bigint;
  governorToken: string;
  lateQuorumVoteExtension: bigint;
};

export type GovernanceConfigChainData = {
  proposalThreshold: bigint;
  votingDelay: bigint;
  votingPeriod: bigint;
  proposalFee: bigint;
};

export type StakeConfigChainData = {
  activationBlocks: bigint;
  cooldownSeconds: bigint;
};

export type RewardBudgetChainData = {
  epochBudget: bigint;
  epochSpent: bigint;
};

export type ContentUpdateConfigChainData = {
  maxVersionsPerContent: bigint | undefined;
  updateFee: bigint | undefined;
};

export async function readSystemSnapshotFromChain(
  publicClient: PublicClient
): Promise<SystemSnapshotChainData> {
  const [
    contentOwner,
    votesContract,
    treasuryContract,
    editLockVotes,
    allowDeleteAfterVote,
    maxVersionsPerContent,
    treasuryOwner,
    epochBudget,
    epochSpent,
    minDelay,
    governorToken,
    lateQuorumVoteExtension,
  ] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "owner",
    }),
    publicClient.readContract({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "votesContract",
    }),
    publicClient.readContract({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "treasury",
    }),
    publicClient.readContract({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "editLockVotes",
    }),
    publicClient.readContract({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "allowDeleteAfterVote",
    }),
    publicClient.readContract({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "maxVersionsPerContent",
    }),
    publicClient.readContract({
      address: CONTRACTS.TreasuryNative as `0x${string}`,
      abi: ABIS.TreasuryNative,
      functionName: "owner",
    }),
    publicClient.readContract({
      address: CONTRACTS.TreasuryNative as `0x${string}`,
      abi: ABIS.TreasuryNative,
      functionName: "epochBudget",
    }),
    publicClient.readContract({
      address: CONTRACTS.TreasuryNative as `0x${string}`,
      abi: ABIS.TreasuryNative,
      functionName: "epochSpent",
    }),
    publicClient.readContract({
      address: CONTRACTS.TimelockController as `0x${string}`,
      abi: ABIS.TimelockController,
      functionName: "getMinDelay",
    }),
    publicClient.readContract({
      address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
      abi: ABIS.KnowledgeGovernor,
      functionName: "token",
    }),
    publicClient.readContract({
      address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
      abi: ABIS.KnowledgeGovernor,
      functionName: "lateQuorumVoteExtension",
    }),
  ]);

  return {
    contentOwner: String(contentOwner ?? ""),
    votesContract: String(votesContract ?? ""),
    treasuryContract: String(treasuryContract ?? ""),
    editLockVotes: asBigInt(editLockVotes) ?? 0n,
    allowDeleteAfterVote: Boolean(allowDeleteAfterVote),
    maxVersionsPerContent: asBigInt(maxVersionsPerContent) ?? 0n,
    treasuryOwner: String(treasuryOwner ?? ""),
    epochBudget: asBigInt(epochBudget) ?? 0n,
    epochSpent: asBigInt(epochSpent) ?? 0n,
    minDelay: asBigInt(minDelay) ?? 0n,
    governorToken: String(governorToken ?? ""),
    lateQuorumVoteExtension: asBigInt(lateQuorumVoteExtension) ?? 0n,
  };
}

export async function readGovernanceConfigFromChain(
  publicClient: PublicClient
): Promise<GovernanceConfigChainData> {
  const [proposalThreshold, votingDelay, votingPeriod, proposalFee] =
    await Promise.all([
      publicClient.readContract({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "proposalThreshold",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "votingDelay",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "votingPeriod",
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "proposalFee",
      }),
    ]);

  return {
    proposalThreshold: asBigInt(proposalThreshold) ?? 0n,
    votingDelay: asBigInt(votingDelay) ?? 0n,
    votingPeriod: asBigInt(votingPeriod) ?? 0n,
    proposalFee: asBigInt(proposalFee) ?? 0n,
  };
}

export async function readStakeConfigFromChain(
  publicClient: PublicClient
): Promise<StakeConfigChainData> {
  const [activationBlocksData, cooldownSecondsData] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "activationBlocks",
    }),
    publicClient.readContract({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "cooldownSeconds",
    }),
  ]);

  return {
    activationBlocks: asBigInt(activationBlocksData) ?? 0n,
    cooldownSeconds: asBigInt(cooldownSecondsData) ?? 0n,
  };
}

export async function readRewardBudgetFromChain(
  publicClient: PublicClient
): Promise<RewardBudgetChainData> {
  const [epochBudget, epochSpent] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.TreasuryNative as `0x${string}`,
      abi: ABIS.TreasuryNative,
      functionName: "epochBudget",
    }),
    publicClient.readContract({
      address: CONTRACTS.TreasuryNative as `0x${string}`,
      abi: ABIS.TreasuryNative,
      functionName: "epochSpent",
    }),
  ]);

  return {
    epochBudget: asBigInt(epochBudget) ?? 0n,
    epochSpent: asBigInt(epochSpent) ?? 0n,
  };
}

export async function readPendingRewardsFromChain(
  publicClient: PublicClient,
  address: `0x${string}`
) {
  const pendingRewards = await publicClient.readContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "pendingRewards",
    args: [address],
  });

  return asBigInt(pendingRewards) ?? 0n;
}

export async function readContentRegisterFeeFromChain(publicClient: PublicClient) {
  const registerFee = await publicClient.readContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "registerFee",
  });

  return asBigInt(registerFee);
}

export async function readContentUpdateConfigFromChain(
  publicClient: PublicClient
): Promise<ContentUpdateConfigChainData> {
  const [maxVersionsPerContentData, updateFeeData] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "maxVersionsPerContent",
    }),
    publicClient.readContract({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "updateFee",
    }),
  ]);

  return {
    maxVersionsPerContent: asBigInt(maxVersionsPerContentData),
    updateFee: asBigInt(updateFeeData),
  };
}
