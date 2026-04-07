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
import { useAccount, usePublicClient } from "wagmi";

import {
  formatAddressSummaryValue,
  ProfileContentSection,
  ProfileDisconnectedState,
  ProfileProposalSection,
  ProfileSummaryCard,
} from "@/components/profile/profile-page-sections";
import { PageHeader } from "@/components/page-header";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import {
  formatMyContentsHelp,
  formatTokenValue,
  getErrorMessage,
  getVisibleContents,
  PROFILE_PAGE_COPY,
  type ContentFilter,
  type ContentSort,
} from "@/lib/profile-page-helpers";
import {
  fetchAllIndexedContents,
  fetchIndexedProfileSummary,
} from "@/lib/indexer-api";
import { readContentCountFromChain, readContentsFromChain } from "@/lib/content-chain";
import { readProposalListWithFallback } from "@/lib/governance-chain";
import { readStakeSummaryFromChain } from "@/lib/stake-summary";
import { readPendingRewardsFromChain } from "@/lib/system-chain";
import type { ContentData } from "@/types/content";
import type { ProposalItem } from "@/types/governance";

type ProfileSummaryState = {
  content_count: number;
  proposal_count: number;
  vote_amount: bigint;
  pending_reward_amount: bigint;
  staked_amount: bigint;
  pending_stake_amount: bigint;
  pending_withdraw_amount: bigint;
};

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [loadingContents, setLoadingContents] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [myContents, setMyContents] = useState<ContentData[]>([]);
  const [indexedContentCount, setIndexedContentCount] = useState<number | null>(null);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [myProposals, setMyProposals] = useState<ProposalItem[]>([]);
  const [profileSummary, setProfileSummary] = useState<ProfileSummaryState | null>(null);
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [contentSort, setContentSort] = useState<ContentSort>("updated_desc");

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
    async () => {
      if (!publicClient || !address) {
        setMyContents([]);
        setIndexedContentCount(null);
        setContentError(null);
        return;
      }

      setLoadingContents(true);
      setContentError(null);

      try {
        const [indexedContents, indexedSummary] = await Promise.all([
          fetchAllIndexedContents({
            author_address: address,
            include_deleted: true,
          }),
          fetchIndexedProfileSummary(address),
        ]);

        if (indexedContents) {
          setMyContents(indexedContents);
          setIndexedContentCount(indexedSummary?.content_count ?? indexedContents.length);
          return;
        }

        const chainContentCount = await readContentCountFromChain(publicClient);
        const total = Number(chainContentCount);
        if (total <= 0) {
          setMyContents([]);
          setIndexedContentCount(0);
          return;
        }

        const authoredContents = (await readContentsFromChain(publicClient, total)).filter(
          (item) => item.author.toLowerCase() === address.toLowerCase()
        );

        setMyContents(authoredContents);
        setIndexedContentCount(authoredContents.length);
      } catch (error) {
        setContentError(
          getErrorMessage(error, PROFILE_PAGE_COPY.loadMyContentsFailed)
        );
      } finally {
        setLoadingContents(false);
      }
    },
    [address, publicClient]
  );

  const loadProfileSummary = useCallback(async () => {
    if (!publicClient || !address) {
      setProfileSummary(null);
      return;
    }

    const indexedSummary = await fetchIndexedProfileSummary(address);

    if (indexedSummary) {
      setProfileSummary({
        content_count: indexedSummary.content_count,
        proposal_count: indexedSummary.proposal_count,
        vote_amount: BigInt(indexedSummary.vote_amount),
        pending_reward_amount: BigInt(indexedSummary.pending_reward_amount),
        staked_amount: BigInt(indexedSummary.staked_amount),
        pending_stake_amount: BigInt(indexedSummary.pending_stake_amount),
        pending_withdraw_amount: BigInt(indexedSummary.pending_withdraw_amount),
      });
      return;
    }

    const [stakeSummary, pendingRewardAmount] = await Promise.all([
      readStakeSummaryFromChain(publicClient, address),
      readPendingRewardsFromChain(publicClient, address),
    ]);

    setProfileSummary({
      content_count: 0,
      proposal_count: 0,
      vote_amount: stakeSummary.vote_amount,
      pending_reward_amount: pendingRewardAmount,
      staked_amount: stakeSummary.staked_amount,
      pending_stake_amount: stakeSummary.pending_stake_amount,
      pending_withdraw_amount: stakeSummary.pending_withdraw_amount,
    });
  }, [address, publicClient]);

  const refreshProfile = useCallback(async () => {
    if (!address) {
      setMyContents([]);
      setMyProposals([]);
      setProfileSummary(null);
      setContentError(null);
      setProposalError(null);
      return;
    }

    try {
      await Promise.all([loadProfileSummary(), loadMyContents()]);
    } catch (error) {
      setContentError(getErrorMessage(error, PROFILE_PAGE_COPY.refreshProfileFailed));
    }
  }, [address, loadMyContents, loadProfileSummary]);

  const loadMyProposals = useCallback(async () => {
    if (!publicClient || !address) {
      setMyProposals([]);
      setProposalError(null);
      return;
    }

      setLoadingProposals(true);
      setProposalError(null);

      try {
        const proposals = await readProposalListWithFallback(publicClient, {
          proposerAddress: address,
        });
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

  const myVotesValue = profileSummary?.vote_amount ?? 0n;
  const myStakedValue = profileSummary?.staked_amount ?? 0n;
  const myPendingStakeValue = profileSummary?.pending_stake_amount ?? 0n;
  const myPendingWithdrawValue = profileSummary?.pending_withdraw_amount ?? 0n;
  const myPendingRewardsValue = profileSummary?.pending_reward_amount ?? 0n;
  const summaryContentCount =
    profileSummary?.content_count ?? indexedContentCount ?? myContents.length;
  const summaryProposalCount = profileSummary?.proposal_count ?? myProposals.length;

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
                value={String(summaryContentCount)}
                description={formatMyContentsHelp(activeContents, deletedContents)}
              />
              <ProfileSummaryCard
                icon={<Gavel className="h-4 w-4" />}
                label={PROFILE_PAGE_COPY.summaryMyProposals}
                value={String(summaryProposalCount)}
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
