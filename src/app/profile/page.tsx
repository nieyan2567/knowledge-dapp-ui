"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatEther } from "viem";
import {
  BookOpen,
  CheckCircle2,
  Coins,
  Gavel,
  ExternalLink,
  FileText,
  UserRound,
  Vote,
} from "lucide-react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";

import { AddressBadge } from "@/components/address-badge";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { collectByBlockRange } from "@/lib/block-range";
import { BRANDING } from "@/lib/branding";
import {
  formatProposalBlockRange,
  governanceStateBadgeClass,
  governanceStateLabel,
  parseProposalCreatedLog,
  proposalCreatedEvent,
  summarizeProposalActions,
} from "@/lib/governance";
import { getIpfsFileUrl } from "@/lib/ipfs";
import { asBigInt, asContentData } from "@/lib/web3-types";
import type { ContentData } from "@/types/content";
import type { ProposalItem } from "@/types/governance";

function formatDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function sortByUpdatedTime(contents: ContentData[]) {
  return [...contents].sort((left, right) =>
    Number(right.lastUpdatedAt - left.lastUpdatedAt)
  );
}

function shortenCid(cid: string) {
  if (cid.length <= 16) {
    return cid;
  }

  return `${cid.slice(0, 8)}...${cid.slice(-8)}`;
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [loadingContents, setLoadingContents] = useState(false);
  const [myContents, setMyContents] = useState<ContentData[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [myProposals, setMyProposals] = useState<ProposalItem[]>([]);

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

  const { data: myPendingRewards, refetch: refetchMyPendingRewards } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "pendingRewards",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const myVotesValue = asBigInt(myVotes) ?? 0n;
  const myPendingRewardsValue = asBigInt(myPendingRewards) ?? 0n;
  const deletedContents = useMemo(
    () => myContents.filter((item) => item.deleted).length,
    [myContents]
  );

  const activeContents = useMemo(
    () => myContents.filter((item) => !item.deleted).length,
    [myContents]
  );

  const loadMyContents = useCallback(
    async (countOverride?: bigint) => {
      if (!publicClient || !address) {
        setMyContents([]);
        return;
      }

      const total = Number(countOverride ?? contentCount ?? 0n);
      if (total <= 0) {
        setMyContents([]);
        return;
      }

      setLoadingContents(true);

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

        setMyContents(sortByUpdatedTime(authoredContents));
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
      return;
    }

    const [countResult] = await Promise.all([
      refetchContentCount(),
      refetchMyVotes(),
      refetchMyPendingRewards(),
    ]);

    await loadMyContents(
      typeof countResult.data === "bigint" ? countResult.data : undefined
    );
  }, [
    address,
    loadMyContents,
    refetchContentCount,
    refetchMyPendingRewards,
    refetchMyVotes,
  ]);

  const loadMyProposals = useCallback(async () => {
    if (!publicClient || !address) {
      setMyProposals([]);
      return;
    }

    setLoadingProposals(true);

    try {
      const latestBlock = await publicClient.getBlockNumber();
      const logs = await collectByBlockRange({
        toBlock: latestBlock,
        fetchRange: ({ fromBlock, toBlock }) =>
          publicClient.getLogs({
            address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
            event: proposalCreatedEvent,
            fromBlock,
            toBlock,
          }),
      });

      const proposals = logs
        .map((log) => parseProposalCreatedLog(log))
        .filter(
          (proposal) => proposal.proposer.toLowerCase() === address.toLowerCase()
        )
        .sort((left, right) => Number(right.blockNumber - left.blockNumber));

      setMyProposals(proposals);
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
        eyebrow="Wallet · Content · Rewards"
        title="Profile"
        description="查看当前钱包地址下的内容、投票权和待领奖励，个人内容会按最近更新时间排序展示。"
        right={
          <Link
            href="/content"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileText className="h-4 w-4" />
            前往内容中心
          </Link>
        }
      />

      {!isConnected || !address ? (
        <SectionCard
          title="连接钱包后查看个人中心"
          description="当前页面需要读取链上账户数据。连接钱包后会显示你的地址、内容列表和奖励信息。"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
            <UserRound className="h-5 w-5 shrink-0" />
            <span>请先在右上角连接钱包。</span>
          </div>
        </SectionCard>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ProfileStatCard
              icon={<UserRound className="h-5 w-5" />}
              label="当前地址"
              value={<AddressBadge address={address} />}
              description="已连接的钱包地址。"
            />
            <ProfileStatCard
              icon={<Vote className="h-5 w-5" />}
              label="投票权"
              value={`${formatEther(myVotesValue)} ${BRANDING.nativeTokenSymbol}`}
              description="当前账户可用于治理投票的票权。"
            />
            <ProfileStatCard
              icon={<Coins className="h-5 w-5" />}
              label="待领奖励"
              value={`${formatEther(myPendingRewardsValue)} ${BRANDING.nativeTokenSymbol}`}
              description="当前可从 Treasury 领取的奖励。"
            />
            <ProfileStatCard
              icon={<BookOpen className="h-5 w-5" />}
              label="我的内容"
              value={String(myContents.length)}
              description={`其中已删除 ${deletedContents} 条，仍会保留历史版本。`}
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="我的内容"
              description={`共 ${myContents.length} 条内容，其中正常内容 ${activeContents} 条。`}
            >
              {loadingContents ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  正在加载你的内容...
                </div>
              ) : myContents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  你还没有发布内容。
                </div>
              ) : (
                <div className="space-y-4">
                  {myContents.map((item) => (
                    <article
                      key={item.id.toString()}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>内容 #{item.id.toString()}</span>
                            <span>·</span>
                            <span>v{item.latestVersion.toString()}</span>
                          </div>
                          <Link
                            href={`/content/${item.id.toString()}`}
                            className="mt-2 block truncate text-lg font-semibold text-slate-950 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300"
                          >
                            {item.title}
                          </Link>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.deleted
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          }`}
                        >
                          {item.deleted ? "已删除" : "正常"}
                        </span>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {item.description || "暂无描述"}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            最新更新时间
                          </div>
                          <div className="mt-1">{formatDate(item.lastUpdatedAt)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            当前票数
                          </div>
                          <div className="mt-1">{item.voteCount.toString()}</div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                        <div className="font-medium text-slate-700 dark:text-slate-200">
                          当前 CID
                        </div>
                        <div className="mt-1 break-all">{shortenCid(item.ipfsHash)}</div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/content/${item.id.toString()}`}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                        >
                          <FileText className="h-4 w-4" />
                          查看详情
                        </Link>
                        <a
                          href={getIpfsFileUrl(item.ipfsHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                          打开文件
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="我发起的提案"
              description={`共 ${myProposals.length} 个提案，按创建区块倒序展示。`}
            >
              {loadingProposals ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  正在加载你的提案...
                </div>
              ) : myProposals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  你还没有发起提案。
                </div>
              ) : (
                <div className="space-y-4">
                  {myProposals.map((proposal) => (
                    <ProfileProposalCard
                      key={proposal.proposalId.toString()}
                      proposal={proposal}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </main>
  );
}

function ProfileProposalCard({ proposal }: { proposal: ProposalItem }) {
  const { data: state } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "state",
    args: [proposal.proposalId],
  });

  const proposalState = asBigInt(state);
  const actionSummaries = useMemo(
    () => summarizeProposalActions(proposal),
    [proposal]
  );

  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700 dark:hover:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>提案 #{proposal.proposalId.toString()}</span>
            <span>·</span>
            <span>创建区块 {proposal.blockNumber.toString()}</span>
          </div>
          <Link
            href={`/governance/${proposal.proposalId.toString()}`}
            className="mt-2 block truncate text-lg font-semibold text-slate-950 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300"
          >
            {proposal.description || "无描述提案"}
          </Link>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${governanceStateBadgeClass(
            proposalState
          )}`}
        >
          {governanceStateLabel(proposalState)}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
          <Gavel className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          提案动作
        </div>
        {actionSummaries.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            暂无可展示的动作摘要。
          </div>
        ) : (
          <div className="space-y-2">
            {actionSummaries.slice(0, 2).map((action, index) => (
              <div key={`${action.functionName}-${index}`}>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {action.title}
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {action.description}
                </div>
              </div>
            ))}
            {actionSummaries.length > 2 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                另外还有 {actionSummaries.length - 2} 个动作，进入详情页可查看完整内容。
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            投票区间
          </div>
          <div className="mt-1">
            {formatProposalBlockRange(proposal.voteStart, proposal.voteEnd)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            动作数量
          </div>
          <div className="mt-1">{proposal.targets.length}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/governance/${proposal.proposalId.toString()}`}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          <CheckCircle2 className="h-4 w-4" />
          查看提案
        </Link>
      </div>
    </article>
  );
}

function ProfileStatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        <div className="text-slate-400 dark:text-slate-500">{icon}</div>
      </div>
      <div className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {description}
      </div>
    </div>
  );
}
