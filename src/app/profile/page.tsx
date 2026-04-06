"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Clock3,
  Coins,
  Gavel,
  RefreshCw,
  UserRound,
  Vote,
  Wallet,
} from "lucide-react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";

import {
  formatAddressSummaryValue,
  ProfileContentSection,
  ProfileDisconnectedState,
  ProfileProposalSection,
  ProfileSummaryCard,
} from "@/components/profile/profile-page-sections";
import { PageHeader } from "@/components/page-header";
import { ABIS, CONTRACTS } from "@/contracts";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { fetchProposalsByProposer } from "@/lib/proposal-events";
import {
  formatMyContentsHelp,
  formatTokenValue,
  getErrorMessage,
  getVisibleContents,
  PROFILE_PAGE_COPY,
  type ContentFilter,
  type ContentSort,
} from "@/lib/profile-page-helpers";
import { asBigInt, asContentData } from "@/lib/web3-types";
import type { ContentData } from "@/types/content";
import type { ProposalItem } from "@/types/governance";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [loadingContents, setLoadingContents] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [myContents, setMyContents] = useState<ContentData[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [myProposals, setMyProposals] = useState<ProposalItem[]>([]);
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [contentSort, setContentSort] = useState<ContentSort>("updated_desc");

  const { data: contentCount, refetch: refetchContentCount } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "contentCount",
  });

  const { data: myVotes, refetch: refetchMyVotes } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "getVotes",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: myStaked, refetch: refetchMyStaked } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "staked",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: myPendingStake, refetch: refetchMyPendingStake } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "pendingStake",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: myPendingWithdraw, refetch: refetchMyPendingWithdraw } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "pendingWithdraw",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: myPendingRewards, refetch: refetchMyPendingRewards } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "pendingRewards",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const myVotesValue = asBigInt(myVotes) ?? 0n;
  const myStakedValue = asBigInt(myStaked) ?? 0n;
  const myPendingStakeValue = asBigInt(myPendingStake) ?? 0n;
  const myPendingWithdrawValue = asBigInt(myPendingWithdraw) ?? 0n;
  const myPendingRewardsValue = asBigInt(myPendingRewards) ?? 0n;

  const deletedContents = useMemo(
    () => myContents.filter((item) => item.deleted).length,
    [myContents]
  );
  const activeContents = useMemo(
    () => myContents.filter((item) => !item.deleted).length,
    [myContents]
  );
  const visibleContents = useMemo(
    () => getVisibleContents(myContents, contentFilter, contentSort),
    [contentFilter, contentSort, myContents]
  );

  const loadMyContents = useCallback(
    async (countOverride?: bigint) => {
      if (!publicClient || !address) {
        setMyContents([]);
        setContentError(null);
        return;
      }

      const total = Number(countOverride ?? contentCount ?? 0n);
      if (total <= 0) {
        setMyContents([]);
        setContentError(null);
        return;
      }

      setLoadingContents(true);
      setContentError(null);

      try {
        const ids = Array.from({ length: total }, (_, index) => BigInt(index + 1));
        const results = await Promise.all(
          ids.map((id) =>
            publicClient.readContract({
              address: CONTRACTS.KnowledgeContent as `0x${string}`,
              abi: ABIS.KnowledgeContent,
              functionName: "contents",
              args: [id],
            })
          )
        );

        const authoredContents = results
          .map((item) => asContentData(item))
          .filter(
            (item): item is ContentData =>
              !!item && item.author.toLowerCase() === address.toLowerCase()
          );

        setMyContents(authoredContents);
      } catch (error) {
        setContentError(
          getErrorMessage(error, PROFILE_PAGE_COPY.loadMyContentsFailed)
        );
      } finally {
        setLoadingContents(false);
      }
    },
    [address, contentCount, publicClient]
  );

  const refreshProfile = useCallback(async () => {
    if (!address) {
      setMyContents([]);
      setMyProposals([]);
      setContentError(null);
      setProposalError(null);
      return;
    }

    try {
      const [countResult] = await Promise.all([
        refetchContentCount(),
        refetchMyVotes(),
        refetchMyStaked(),
        refetchMyPendingStake(),
        refetchMyPendingWithdraw(),
        refetchMyPendingRewards(),
      ]);

      await loadMyContents(
        typeof countResult.data === "bigint" ? countResult.data : undefined
      );
    } catch (error) {
      setContentError(getErrorMessage(error, PROFILE_PAGE_COPY.refreshProfileFailed));
    }
  }, [
    address,
    loadMyContents,
    refetchContentCount,
    refetchMyPendingRewards,
    refetchMyPendingStake,
    refetchMyPendingWithdraw,
    refetchMyStaked,
    refetchMyVotes,
  ]);

  const loadMyProposals = useCallback(async () => {
    if (!publicClient || !address) {
      setMyProposals([]);
      setProposalError(null);
      return;
    }

    setLoadingProposals(true);
    setProposalError(null);

    try {
      const proposals = await fetchProposalsByProposer(publicClient, address);
      setMyProposals(proposals);
    } catch (error) {
      setProposalError(
        getErrorMessage(error, PROFILE_PAGE_COPY.loadMyProposalsFailed)
      );
    } finally {
      setLoadingProposals(false);
    }
  }, [address, publicClient]);

  const refreshProfilePage = useCallback(async () => {
    await Promise.all([refreshProfile(), loadMyProposals()]);
  }, [loadMyProposals, refreshProfile]);

  useEffect(() => {
    void refreshProfilePage();
  }, [refreshProfilePage]);

  useTxEventRefetch(
    useMemo(
      () => ["content", "rewards", "stake", "dashboard", "governance", "system"] as const,
      []
    ),
    useMemo(() => [refreshProfilePage], [refreshProfilePage])
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow={PROFILE_PAGE_COPY.headerEyebrow}
        title={PROFILE_PAGE_COPY.headerTitle}
        description={PROFILE_PAGE_COPY.headerDescription}
        right={
          <button
            type="button"
            onClick={() => void refreshProfilePage()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            {PROFILE_PAGE_COPY.refresh}
          </button>
        }
      />

      {!isConnected || !address ? (
        <ProfileDisconnectedState />
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <ProfileSummaryCard
                icon={<UserRound className="h-4 w-4" />}
                label={PROFILE_PAGE_COPY.summaryAddress}
                value={formatAddressSummaryValue(address)}
                description={PROFILE_PAGE_COPY.summaryAddressHelp}
              />
              <ProfileSummaryCard
                icon={<Vote className="h-4 w-4" />}
                label={PROFILE_PAGE_COPY.summaryVotes}
                value={formatTokenValue(myVotesValue)}
                description={PROFILE_PAGE_COPY.summaryVotesHelp}
              />
              <ProfileSummaryCard
                icon={<Coins className="h-4 w-4" />}
                label={PROFILE_PAGE_COPY.summaryStaked}
                value={formatTokenValue(myStakedValue)}
                description={PROFILE_PAGE_COPY.summaryStakedHelp}
              />
              <ProfileSummaryCard
                icon={<Clock3 className="h-4 w-4" />}
                label={PROFILE_PAGE_COPY.summaryPendingStake}
                value={formatTokenValue(myPendingStakeValue)}
                description={PROFILE_PAGE_COPY.summaryPendingStakeHelp}
              />
              <ProfileSummaryCard
                icon={<Wallet className="h-4 w-4" />}
                label={PROFILE_PAGE_COPY.summaryPendingWithdraw}
                value={formatTokenValue(myPendingWithdrawValue)}
                description={PROFILE_PAGE_COPY.summaryPendingWithdrawHelp}
              />
              <ProfileSummaryCard
                icon={<Coins className="h-4 w-4" />}
                label={PROFILE_PAGE_COPY.summaryPendingRewards}
                value={formatTokenValue(myPendingRewardsValue)}
                description={PROFILE_PAGE_COPY.summaryPendingRewardsHelp}
              />
              <ProfileSummaryCard
                icon={<BookOpen className="h-4 w-4" />}
                label={PROFILE_PAGE_COPY.summaryMyContents}
                value={String(myContents.length)}
                description={formatMyContentsHelp(activeContents, deletedContents)}
              />
              <ProfileSummaryCard
                icon={<Gavel className="h-4 w-4" />}
                label={PROFILE_PAGE_COPY.summaryMyProposals}
                value={String(myProposals.length)}
                description={PROFILE_PAGE_COPY.summaryMyProposalsHelp}
              />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <ProfileContentSection
              myContents={myContents}
              visibleContents={visibleContents}
              contentFilter={contentFilter}
              contentSort={contentSort}
              loadingContents={loadingContents}
              contentError={contentError}
              onFilterChange={setContentFilter}
              onSortChange={setContentSort}
              onRefresh={() => void refreshProfile()}
            />

            <ProfileProposalSection
              myProposals={myProposals}
              loadingProposals={loadingProposals}
              proposalError={proposalError}
              onRefresh={() => void loadMyProposals()}
            />
          </div>
        </>
      )}
    </main>
  );
}
