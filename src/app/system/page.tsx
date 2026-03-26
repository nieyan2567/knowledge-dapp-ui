"use client";

import { useMemo } from "react";
import { formatEther } from "viem";
import { useReadContract } from "wagmi";

import { AddressBadge } from "@/components/address-badge";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { BRANDING } from "@/lib/branding";
import { asBigInt } from "@/lib/web3-types";

function explorerAddressUrl(address: string) {
  return `${BRANDING.explorerUrl}/address/${address}`;
}

function formatBoolean(value: unknown) {
  if (typeof value !== "boolean") {
    return "-";
  }

  return value ? "是" : "否";
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
        eyebrow="Contracts · Roles · Treasury"
        title="System Overview"
        description="查看当前合约绑定关系、治理参数以及金库状态。"
        right={
          <a
            href={BRANDING.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            打开 {BRANDING.explorerName}
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="KnowledgeContent">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span>合约地址</span>
              <AddressBadge address={CONTRACTS.KnowledgeContent} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>所有者</span>
              <AddressBadge address={String(contentOwner ?? "")} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>投票合约</span>
              <AddressBadge address={String(votesContract ?? "")} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>金库合约</span>
              <AddressBadge address={String(treasury ?? "")} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>编辑锁定票数</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {editLockVotes ? String(editLockVotes) : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>投票后允许删除</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {formatBoolean(allowDeleteAfterVote)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>单内容最大版本数</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {maxVersionsPerContent ? String(maxVersionsPerContent) : "-"}
              </span>
            </div>

            <div className="pt-2">
              <a
                href={explorerAddressUrl(CONTRACTS.KnowledgeContent)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                在 {BRANDING.explorerName} 查看
              </a>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="TreasuryNative">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span>合约地址</span>
              <AddressBadge address={CONTRACTS.TreasuryNative} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>所有者</span>
              <AddressBadge address={String(treasuryOwner ?? "")} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>周期预算</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {epochBudgetValue ? formatEther(epochBudgetValue) : "0"} {BRANDING.nativeTokenSymbol}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>周期已用</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {epochSpentValue ? formatEther(epochSpentValue) : "0"} {BRANDING.nativeTokenSymbol}
              </span>
            </div>

            <div className="pt-2">
              <a
                href={explorerAddressUrl(CONTRACTS.TreasuryNative)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                在 {BRANDING.explorerName} 查看
              </a>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Governor">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span>合约地址</span>
              <AddressBadge address={CONTRACTS.KnowledgeGovernor} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>治理代币</span>
              <AddressBadge address={String(governorToken ?? "")} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>法定人数延长</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {lateQuorumVoteExtension ? String(lateQuorumVoteExtension) : "-"} 个区块
              </span>
            </div>

            <div className="pt-2">
              <a
                href={explorerAddressUrl(CONTRACTS.KnowledgeGovernor)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                在 {BRANDING.explorerName} 查看
              </a>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Timelock">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span>合约地址</span>
              <AddressBadge address={CONTRACTS.TimelockController} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>最小延迟</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {minDelayValue ? String(minDelayValue) : "-"} 秒
              </span>
            </div>

            <div className="pt-2">
              <a
                href={explorerAddressUrl(CONTRACTS.TimelockController)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                在 {BRANDING.explorerName} 查看
              </a>
            </div>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
