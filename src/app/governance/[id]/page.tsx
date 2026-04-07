"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Gavel,
  Vote as VoteIcon,
} from "lucide-react";

import { AddressBadge } from "@/components/address-badge";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useLiveChainClock } from "@/hooks/useLiveChainClock";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { BRANDING } from "@/lib/branding";
import { GOVERNANCE_DETAIL_COPY } from "@/lib/governance-detail-helpers";
import { readProposalDetailFromChain } from "@/lib/governance-chain";
import {
  getProposalStageCountdown,
  governanceStateBadgeClass as stateBadgeClass,
  governanceStateLabel as stateLabel,
  summarizeProposalActions,
} from "@/lib/governance";
import { fetchIndexedProposalDetail } from "@/lib/indexer-api";
import { reportClientError } from "@/lib/observability/client";
import { writeTxToast } from "@/lib/tx-toast";
import type { ProposalItem, ProposalVotes } from "@/types/governance";

function explorerProposalUrl(txHash: string) {
  if (!txHash || txHash === "0x") return "#";
  return `${BRANDING.explorerUrl}/tx/${txHash}`;
}

function reportProposalDetailError(message: string, error: unknown) {
  void reportClientError({
    message,
    source: "governance.detail",
    severity: "error",
    handled: true,
    error,
  });
}

export default function ProposalDetailPage() {
  const params = useParams();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const refreshAfterTx = useRefreshOnTxConfirmed();
  const { nowTs, liveBlockNumber } = useLiveChainClock();

  const [proposalDetail, setProposalDetail] = useState<ProposalItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [liveProposalState, setLiveProposalState] = useState<bigint | undefined>(
    undefined
  );
  const [liveProposalEta, setLiveProposalEta] = useState<bigint | undefined>(undefined);
  const [liveVotes, setLiveVotes] = useState<ProposalVotes>({
    againstVotes: 0n,
    forVotes: 0n,
    abstainVotes: 0n,
  });

  const proposalId = useMemo(() => {
    const raw = typeof params?.id === "string" ? params.id : null;
    if (!raw || !/^\d+$/.test(raw)) {
      return null;
    }
    return BigInt(raw);
  }, [params]);

  const proposalState = liveProposalState;
  const proposalEtaValue = liveProposalEta;
  const voteData: ProposalVotes = liveVotes;

  const totalVotes =
    voteData.forVotes + voteData.againstVotes + voteData.abstainVotes;
  const forPercent =
    totalVotes > 0n ? Number((voteData.forVotes * 100n) / totalVotes) : 0;
  const againstPercent =
    totalVotes > 0n ? Number((voteData.againstVotes * 100n) / totalVotes) : 0;
  const abstainPercent =
    totalVotes > 0n ? Number((voteData.abstainVotes * 100n) / totalVotes) : 0;

  const canVote = Number(proposalState ?? -1) === 1;
  const canQueue = Number(proposalState ?? -1) === 4;
  const isQueued = Number(proposalState ?? -1) === 5;
  const canExecute =
    isQueued &&
    proposalEtaValue !== undefined &&
    proposalEtaValue > 0n &&
    BigInt(nowTs) >= proposalEtaValue;

  const actionSummaries = useMemo(
    () => (proposalDetail ? summarizeProposalActions(proposalDetail) : []),
    [proposalDetail]
  );

  const countdown = useMemo(
    () =>
      getProposalStageCountdown(
        liveBlockNumber,
        proposalDetail?.voteStart,
        proposalDetail?.voteEnd,
        proposalState,
        proposalEtaValue,
        BigInt(nowTs)
      ),
    [
      liveBlockNumber,
      nowTs,
      proposalDetail?.voteEnd,
      proposalDetail?.voteStart,
      proposalEtaValue,
      proposalState,
    ]
  );

  const loadProposalDetail = useCallback(async () => {
    if (!publicClient || proposalId === null) {
      setProposalDetail(null);
      return;
    }

    setLoadingDetail(true);
    try {
      const indexedDetail = await fetchIndexedProposalDetail(proposalId);

      if (indexedDetail) {
        setProposalDetail(indexedDetail);
        setLiveProposalState(indexedDetail.stateValue);
        setLiveProposalEta(indexedDetail.etaSecond);
        setLiveVotes(
          indexedDetail.votes ?? {
            againstVotes: 0n,
            forVotes: 0n,
            abstainVotes: 0n,
          }
        );
        return;
      }

      const fallbackDetail = await readProposalDetailFromChain(publicClient, proposalId);
      setProposalDetail(fallbackDetail.detail);
      setLiveProposalState(fallbackDetail.state);
      setLiveProposalEta(fallbackDetail.eta);
      setLiveVotes(fallbackDetail.votes);
    } catch (error) {
      reportProposalDetailError("Failed to load proposal detail", error);
    } finally {
      setLoadingDetail(false);
    }
  }, [proposalId, publicClient]);

  useEffect(() => {
    void loadProposalDetail();
  }, [loadProposalDetail]);

  const refreshProposalDetail = useCallback(async () => {
    await loadProposalDetail();
  }, [loadProposalDetail]);

  const governanceRefreshDomains = useMemo(
    () => ["governance", "system"] as const,
    []
  );
  const governanceRefetchers = useMemo(
    () => [refreshProposalDetail],
    [refreshProposalDetail]
  );

  useTxEventRefetch(governanceRefreshDomains, governanceRefetchers);

  useEffect(() => {
    if (liveBlockNumber === undefined || proposalId === null) {
      return;
    }

    void loadProposalDetail();
  }, [liveBlockNumber, proposalId, loadProposalDetail]);

  async function vote(support: 0 | 1 | 2) {
    if (!address || !proposalId) {
      toast.error(GOVERNANCE_DETAIL_COPY.errors.connectWallet);
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "castVote",
        args: [proposalId, support],
        account: address,
      },
      loading: GOVERNANCE_DETAIL_COPY.loading.vote,
      success: GOVERNANCE_DETAIL_COPY.success.vote,
      fail: GOVERNANCE_DETAIL_COPY.fail.vote,
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshProposalDetail, ["governance", "system"]);
  }

  async function queueProposal() {
    if (!proposalDetail || !address) {
      toast.error(GOVERNANCE_DETAIL_COPY.errors.detailMissingQueue);
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "queue",
        args: [
          proposalDetail.targets,
          proposalDetail.values,
          proposalDetail.calldatas,
          proposalDetail.descriptionHash,
        ],
        account: address,
      },
      loading: GOVERNANCE_DETAIL_COPY.loading.queue,
      success: GOVERNANCE_DETAIL_COPY.success.queue,
      fail: GOVERNANCE_DETAIL_COPY.fail.queue,
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshProposalDetail, ["governance", "system"]);
  }

  async function executeProposal() {
    if (!proposalDetail || !address) {
      toast.error(GOVERNANCE_DETAIL_COPY.errors.detailMissingExecute);
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "execute",
        args: [
          proposalDetail.targets,
          proposalDetail.values,
          proposalDetail.calldatas,
          proposalDetail.descriptionHash,
        ],
        account: address,
      },
      loading: GOVERNANCE_DETAIL_COPY.loading.execute,
      success: GOVERNANCE_DETAIL_COPY.success.execute,
      fail: GOVERNANCE_DETAIL_COPY.fail.execute,
    });

    if (!hash) return;
    await refreshAfterTx(hash, refreshProposalDetail, ["governance", "system"]);
  }

  if (!proposalId) {
    return null;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/governance"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {GOVERNANCE_DETAIL_COPY.backToList}
        </Link>
      </div>

      <PageHeader
        eyebrow={GOVERNANCE_DETAIL_COPY.status.proposalEyebrow(proposalId)}
        title={proposalDetail?.description || GOVERNANCE_DETAIL_COPY.pageTitleFallback}
        description={GOVERNANCE_DETAIL_COPY.pageDescription}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px] xl:items-start">
        <div className="space-y-6">
          <SectionCard
            title={GOVERNANCE_DETAIL_COPY.voteDistributionTitle}
            description={GOVERNANCE_DETAIL_COPY.voteDistributionDescription}
          >
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Gavel className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {GOVERNANCE_DETAIL_COPY.currentState}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                    {countdown.label}: {countdown.value}
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${stateBadgeClass(proposalState)}`}
                  >
                    {stateLabel(proposalState)}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <InfoCard
                  compact
                  label={GOVERNANCE_DETAIL_COPY.totalVotes}
                  value={totalVotes === 0n ? "0" : formatEther(totalVotes)}
                />
                <InfoCard
                  compact
                  label={GOVERNANCE_DETAIL_COPY.forVotes}
                  value={voteData.forVotes === 0n ? "0" : formatEther(voteData.forVotes)}
                />
                <InfoCard
                  compact
                  label={GOVERNANCE_DETAIL_COPY.againstVotes}
                  value={
                    voteData.againstVotes === 0n ? "0" : formatEther(voteData.againstVotes)
                  }
                />
                <InfoCard
                  compact
                  label={GOVERNANCE_DETAIL_COPY.abstainVotes}
                  value={
                    voteData.abstainVotes === 0n ? "0" : formatEther(voteData.abstainVotes)
                  }
                />
              </div>

              <div className="space-y-4">
                <VoteBar
                  label={GOVERNANCE_DETAIL_COPY.forLabel}
                  value={voteData.forVotes}
                  percent={forPercent}
                  color="bg-emerald-500"
                />
                <VoteBar
                  label={GOVERNANCE_DETAIL_COPY.againstLabel}
                  value={voteData.againstVotes}
                  percent={againstPercent}
                  color="bg-rose-500"
                />
                <VoteBar
                  label={GOVERNANCE_DETAIL_COPY.abstainLabel}
                  value={voteData.abstainVotes}
                  percent={abstainPercent}
                  color="bg-slate-500"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={GOVERNANCE_DETAIL_COPY.actionsTitle}
            description={GOVERNANCE_DETAIL_COPY.actionsDescription}
          >
            {loadingDetail ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {GOVERNANCE_DETAIL_COPY.loading.detail}
              </div>
            ) : !proposalDetail ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {GOVERNANCE_DETAIL_COPY.noActionData}
              </div>
            ) : proposalDetail.targets.length === 0 ? (
              <div className="text-sm italic text-slate-500 dark:text-slate-400">
                {GOVERNANCE_DETAIL_COPY.noOnchainActions}
              </div>
            ) : (
              <div className="space-y-4">
                {proposalDetail.targets.map((target, index) => {
                  const summary = actionSummaries[index];

                  return (
                    <div
                      key={`${target}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {GOVERNANCE_DETAIL_COPY.status.actionPrefix(index)}
                          </div>
                          <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                            {summary?.title ?? GOVERNANCE_DETAIL_COPY.unknownAction}
                          </div>
                        </div>
                        <div className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {summary?.functionName ?? GOVERNANCE_DETAIL_COPY.unknownFunction}
                        </div>
                      </div>

                      <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
                        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {GOVERNANCE_DETAIL_COPY.summaryLabel}
                          </div>
                          <div className="mt-1.5">
                            {summary?.description ?? GOVERNANCE_DETAIL_COPY.noSummary}
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {GOVERNANCE_DETAIL_COPY.targetContract}
                            </div>
                            <div className="mt-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/60">
                              <span className="break-all font-mono text-xs text-slate-700 dark:text-slate-300">
                                {target}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {GOVERNANCE_DETAIL_COPY.callValue}
                            </div>
                            <div className="mt-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/60">
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                                {proposalDetail.values[index]?.toString() ?? "0"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {GOVERNANCE_DETAIL_COPY.rawCalldata}
                          </div>
                          <div className="mt-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/60">
                            <span className="break-all font-mono text-xs text-slate-700 dark:text-slate-300">
                              {summary?.rawCalldata ?? proposalDetail.calldatas[index]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6">
          <SectionCard
            title={GOVERNANCE_DETAIL_COPY.panelTitle}
            description={GOVERNANCE_DETAIL_COPY.panelDescription}
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="rounded-lg bg-white/80 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                  {canVote
                    ? GOVERNANCE_DETAIL_COPY.actionPanelVote
                    : canQueue
                      ? GOVERNANCE_DETAIL_COPY.actionPanelQueue
                      : canExecute
                        ? GOVERNANCE_DETAIL_COPY.actionPanelExecute
                        : GOVERNANCE_DETAIL_COPY.actionPanelIdle}
                </div>
              </div>

              <button
                onClick={() => void vote(1)}
                disabled={!canVote}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <VoteIcon className="h-4 w-4" />
                {GOVERNANCE_DETAIL_COPY.voteFor}
              </button>

              <button
                onClick={() => void vote(0)}
                disabled={!canVote}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {GOVERNANCE_DETAIL_COPY.voteAgainst}
              </button>

              <button
                onClick={() => void vote(2)}
                disabled={!canVote}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {GOVERNANCE_DETAIL_COPY.voteAbstain}
              </button>

              <div className="my-2 border-t border-slate-200 pt-2 dark:border-slate-700" />

              <button
                onClick={() => void queueProposal()}
                disabled={!canQueue || !proposalDetail}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {GOVERNANCE_DETAIL_COPY.queueProposal}
              </button>

              <button
                onClick={() => void executeProposal()}
                disabled={!canExecute || !proposalDetail}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              >
                <CheckCircle2 className="h-4 w-4" />
                {GOVERNANCE_DETAIL_COPY.executeProposal}
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title={GOVERNANCE_DETAIL_COPY.infoTitle}
            description={GOVERNANCE_DETAIL_COPY.infoDescription}
          >
            {loadingDetail ? (
              <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">
                {GOVERNANCE_DETAIL_COPY.loading.detail}
              </div>
            ) : !proposalDetail ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {GOVERNANCE_DETAIL_COPY.proposalEventMissing}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <InfoCard compact label={GOVERNANCE_DETAIL_COPY.info.proposalId} value={proposalId.toString()} />
                  <InfoCard compact label={GOVERNANCE_DETAIL_COPY.info.createdBlock} value={proposalDetail.blockNumber.toString()} />
                  <InfoCard compact label={GOVERNANCE_DETAIL_COPY.info.voteStart} value={proposalDetail.voteStart.toString()} />
                  <InfoCard compact label={GOVERNANCE_DETAIL_COPY.info.voteEnd} value={proposalDetail.voteEnd.toString()} />
                  <InfoCard compact label={countdown.label} value={countdown.value} />
                  <InfoCard compact label={GOVERNANCE_DETAIL_COPY.info.actionCount} value={proposalDetail.targets.length.toString()} />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {GOVERNANCE_DETAIL_COPY.info.proposer}
                  </div>
                  <div className="text-sm text-slate-900 dark:text-slate-100">
                    <AddressBadge address={proposalDetail.proposer} />
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={GOVERNANCE_DETAIL_COPY.explorerTitle}
            description={GOVERNANCE_DETAIL_COPY.explorerDescription}
          >
            <a
              href={proposalDetail?.transactionHash ? explorerProposalUrl(proposalDetail.transactionHash) : "#"}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-2 text-sm font-medium ${
                proposalDetail?.transactionHash
                  ? "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  : "cursor-not-allowed text-slate-400"
              }`}
              onClick={(event) => {
                if (!proposalDetail?.transactionHash) {
                  event.preventDefault();
                  toast.error(GOVERNANCE_DETAIL_COPY.errors.missingTxHash);
                }
              }}
            >
              {GOVERNANCE_DETAIL_COPY.browserOpen}
              <ExternalLink className="h-4 w-4" />
            </a>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div
        className={`text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${
          compact ? "mb-1" : "mb-2"
        }`}
      >
        {label}
      </div>
      <div
        className={`break-all font-medium text-slate-900 dark:text-slate-100 ${
          compact ? "text-[13px]" : "text-sm"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function VoteBar({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: bigint;
  percent: number;
  color: string;
}) {
  const formattedValue = value === 0n ? "0" : formatEther(value);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </div>
        <div className="font-mono text-sm text-slate-500 dark:text-slate-400">
          {formattedValue} <span className="mx-1">/</span> {percent}%
        </div>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full ${color} transition-all duration-500 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
