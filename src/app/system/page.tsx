"use client";

import { useMemo, type ReactNode } from "react";
import { formatEther } from "viem";
import { useReadContract } from "wagmi";

import { AddressBadge } from "@/components/address-badge";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { BRANDING } from "@/lib/branding";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import { formatSystemBoolean, SYSTEM_PAGE_COPY } from "@/lib/system-page-helpers";
import { asBigInt } from "@/lib/web3-types";

function explorerAddressUrl(address: string) {
  return `${BRANDING.explorerUrl}/address/${address}`;
}

export default function SystemPage() {
  const { data: contentOwner, refetch: refetchContentOwner } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "owner",
  });

  const { data: votesContract, refetch: refetchVotesContract } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "votesContract",
  });

  const { data: treasury, refetch: refetchTreasury } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "treasury",
  });

  const { data: editLockVotes, refetch: refetchEditLockVotes } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "editLockVotes",
  });

  const {
    data: allowDeleteAfterVote,
    refetch: refetchAllowDeleteAfterVote,
  } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "allowDeleteAfterVote",
  });

  const {
    data: maxVersionsPerContent,
    refetch: refetchMaxVersionsPerContent,
  } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "maxVersionsPerContent",
  });

  const { data: treasuryOwner, refetch: refetchTreasuryOwner } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "owner",
  });

  const { data: epochBudget, refetch: refetchEpochBudget } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "epochBudget",
  });

  const { data: epochSpent, refetch: refetchEpochSpent } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "epochSpent",
  });

  const { data: minDelay, refetch: refetchMinDelay } = useReadContract({
    address: CONTRACTS.TimelockController as `0x${string}`,
    abi: ABIS.TimelockController,
    functionName: "getMinDelay",
  });

  const { data: governorToken, refetch: refetchGovernorToken } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "token",
  });

  const {
    data: lateQuorumVoteExtension,
    refetch: refetchLateQuorumVoteExtension,
  } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "lateQuorumVoteExtension",
  });

  const epochBudgetValue = asBigInt(epochBudget);
  const epochSpentValue = asBigInt(epochSpent);
  const minDelayValue = asBigInt(minDelay);

  const systemRefreshDomains = useMemo(
    () => ["rewards", "content", "governance", "system"] as const,
    []
  );

  const systemRefetchers = useMemo(
    () => [
      refetchContentOwner,
      refetchVotesContract,
      refetchTreasury,
      refetchEditLockVotes,
      refetchAllowDeleteAfterVote,
      refetchMaxVersionsPerContent,
      refetchTreasuryOwner,
      refetchEpochBudget,
      refetchEpochSpent,
      refetchGovernorToken,
      refetchLateQuorumVoteExtension,
      refetchMinDelay,
    ],
    [
      refetchContentOwner,
      refetchVotesContract,
      refetchTreasury,
      refetchEditLockVotes,
      refetchAllowDeleteAfterVote,
      refetchMaxVersionsPerContent,
      refetchTreasuryOwner,
      refetchEpochBudget,
      refetchEpochSpent,
      refetchGovernorToken,
      refetchLateQuorumVoteExtension,
      refetchMinDelay,
    ]
  );

  useTxEventRefetch(systemRefreshDomains, systemRefetchers);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow={SYSTEM_PAGE_COPY.headerEyebrow}
        title={SYSTEM_PAGE_COPY.headerTitle}
        description={SYSTEM_PAGE_COPY.headerDescription}
        testId={PAGE_TEST_IDS.system}
        right={
          <a
            href={BRANDING.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {SYSTEM_PAGE_COPY.openExplorer}
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="KnowledgeContent">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <SystemRow label={SYSTEM_PAGE_COPY.contractAddress}>
              <AddressBadge address={CONTRACTS.KnowledgeContent} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.owner}>
              <AddressBadge address={String(contentOwner ?? "")} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.votesContract}>
              <AddressBadge address={String(votesContract ?? "")} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.treasuryContract}>
              <AddressBadge address={String(treasury ?? "")} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.editLockVotes}>
              {editLockVotes ? String(editLockVotes) : "-"}
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.allowDeleteAfterVote}>
              {formatSystemBoolean(allowDeleteAfterVote)}
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.maxVersionsPerContent}>
              {maxVersionsPerContent ? String(maxVersionsPerContent) : "-"}
            </SystemRow>

            <SystemExplorerLink address={CONTRACTS.KnowledgeContent} />
          </div>
        </SectionCard>

        <SectionCard title="TreasuryNative">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <SystemRow label={SYSTEM_PAGE_COPY.contractAddress}>
              <AddressBadge address={CONTRACTS.TreasuryNative} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.owner}>
              <AddressBadge address={String(treasuryOwner ?? "")} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.cycleBudget}>
              {epochBudgetValue ? formatEther(epochBudgetValue) : "0"}{" "}
              {BRANDING.nativeTokenSymbol}
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.cycleSpent}>
              {epochSpentValue ? formatEther(epochSpentValue) : "0"}{" "}
              {BRANDING.nativeTokenSymbol}
            </SystemRow>

            <SystemExplorerLink address={CONTRACTS.TreasuryNative} />
          </div>
        </SectionCard>

        <SectionCard title="Governor">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <SystemRow label={SYSTEM_PAGE_COPY.contractAddress}>
              <AddressBadge address={CONTRACTS.KnowledgeGovernor} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.governanceToken}>
              <AddressBadge address={String(governorToken ?? "")} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.lateQuorumExtension}>
              {lateQuorumVoteExtension ? String(lateQuorumVoteExtension) : "-"}{" "}
              {SYSTEM_PAGE_COPY.blockUnit}
            </SystemRow>

            <SystemExplorerLink address={CONTRACTS.KnowledgeGovernor} />
          </div>
        </SectionCard>

        <SectionCard title="Timelock">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <SystemRow label={SYSTEM_PAGE_COPY.contractAddress}>
              <AddressBadge address={CONTRACTS.TimelockController} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.minDelay}>
              {minDelayValue ? String(minDelayValue) : "-"} {SYSTEM_PAGE_COPY.secondsUnit}
            </SystemRow>

            <SystemExplorerLink address={CONTRACTS.TimelockController} />
          </div>
        </SectionCard>
      </div>
    </main>
  );
}

function SystemRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="font-medium text-slate-900 dark:text-slate-100">{children}</span>
    </div>
  );
}

function SystemExplorerLink({ address }: { address: string }) {
  return (
    <div className="pt-2">
      <a
        href={explorerAddressUrl(address)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {SYSTEM_PAGE_COPY.explorerAction}
      </a>
    </div>
  );
}
