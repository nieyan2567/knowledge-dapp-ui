"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatEther } from "viem";
import { usePublicClient } from "wagmi";

import { AddressBadge } from "@/components/address-badge";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { CONTRACTS } from "@/contracts";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { BRANDING } from "@/lib/branding";
import { fetchIndexedSystemSnapshot } from "@/lib/indexer-api";
import { readSystemSnapshotFromChain } from "@/lib/system-chain";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import { formatSystemBoolean, SYSTEM_PAGE_COPY } from "@/lib/system-page-helpers";

type SystemSnapshotState = {
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

function explorerAddressUrl(address: string) {
  return `${BRANDING.explorerUrl}/address/${address}`;
}

function emptySystemSnapshot(): SystemSnapshotState {
  return {
    contentOwner: "",
    votesContract: "",
    treasuryContract: "",
    editLockVotes: 0n,
    allowDeleteAfterVote: false,
    maxVersionsPerContent: 0n,
    treasuryOwner: "",
    epochBudget: 0n,
    epochSpent: 0n,
    minDelay: 0n,
    governorToken: "",
    lateQuorumVoteExtension: 0n,
  };
}

export default function SystemPage() {
  const publicClient = usePublicClient();
  const [snapshot, setSnapshot] = useState<SystemSnapshotState>(emptySystemSnapshot);

  const loadSystemSnapshot = useCallback(async () => {
    const indexedSnapshot = await fetchIndexedSystemSnapshot();

    if (indexedSnapshot) {
      setSnapshot({
        contentOwner: indexedSnapshot.content_owner_address ?? "",
        votesContract: indexedSnapshot.votes_contract_address ?? "",
        treasuryContract: indexedSnapshot.treasury_contract_address ?? "",
        editLockVotes: BigInt(indexedSnapshot.edit_lock_votes),
        allowDeleteAfterVote: indexedSnapshot.is_allow_delete_after_vote === 1,
        maxVersionsPerContent: BigInt(indexedSnapshot.max_versions_per_content),
        treasuryOwner: indexedSnapshot.treasury_owner_address ?? "",
        epochBudget: BigInt(indexedSnapshot.epoch_budget_amount),
        epochSpent: BigInt(indexedSnapshot.epoch_spent_amount),
        minDelay: BigInt(indexedSnapshot.timelock_min_delay_second),
        governorToken: indexedSnapshot.governor_token_address ?? "",
        lateQuorumVoteExtension: BigInt(
          indexedSnapshot.late_quorum_vote_extension_block
        ),
      });
      return;
    }

    if (!publicClient) {
      setSnapshot(emptySystemSnapshot());
      return;
    }

    const fallbackSnapshot = await readSystemSnapshotFromChain(publicClient);

    setSnapshot({
      contentOwner: fallbackSnapshot.contentOwner,
      votesContract: fallbackSnapshot.votesContract,
      treasuryContract: fallbackSnapshot.treasuryContract,
      editLockVotes: fallbackSnapshot.editLockVotes,
      allowDeleteAfterVote: fallbackSnapshot.allowDeleteAfterVote,
      maxVersionsPerContent: fallbackSnapshot.maxVersionsPerContent,
      treasuryOwner: fallbackSnapshot.treasuryOwner,
      epochBudget: fallbackSnapshot.epochBudget,
      epochSpent: fallbackSnapshot.epochSpent,
      minDelay: fallbackSnapshot.minDelay,
      governorToken: fallbackSnapshot.governorToken,
      lateQuorumVoteExtension: fallbackSnapshot.lateQuorumVoteExtension,
    });
  }, [publicClient]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSystemSnapshot();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadSystemSnapshot]);

  const systemRefreshDomains = useMemo(
    () => ["rewards", "content", "governance", "system", "stake"] as const,
    []
  );

  const systemRefetchers = useMemo(() => [loadSystemSnapshot], [loadSystemSnapshot]);

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
              <AddressBadge address={snapshot.contentOwner} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.votesContract}>
              <AddressBadge address={snapshot.votesContract} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.treasuryContract}>
              <AddressBadge address={snapshot.treasuryContract} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.editLockVotes}>
              {snapshot.editLockVotes.toString()}
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.allowDeleteAfterVote}>
              {formatSystemBoolean(snapshot.allowDeleteAfterVote)}
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.maxVersionsPerContent}>
              {snapshot.maxVersionsPerContent.toString()}
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
              <AddressBadge address={snapshot.treasuryOwner} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.cycleBudget}>
              {formatEther(snapshot.epochBudget)} {BRANDING.nativeTokenSymbol}
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.cycleSpent}>
              {formatEther(snapshot.epochSpent)} {BRANDING.nativeTokenSymbol}
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
              <AddressBadge address={snapshot.governorToken} />
            </SystemRow>
            <SystemRow label={SYSTEM_PAGE_COPY.lateQuorumExtension}>
              {snapshot.lateQuorumVoteExtension.toString()} {SYSTEM_PAGE_COPY.blockUnit}
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
              {snapshot.minDelay.toString()} {SYSTEM_PAGE_COPY.secondsUnit}
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
