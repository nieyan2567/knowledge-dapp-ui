"use client";

import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { Navbar } from "@/components/navbar";
import { ABIS, CONTRACTS } from "@/contracts";
import { SectionCard } from "@/components/section-card";

export default function SystemPage() {
  const { data: contentOwner } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "owner",
  });

  const { data: votesContract } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "votesContract",
  });

  const { data: treasury } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "treasury",
  });

  const { data: treasuryOwner } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "owner",
  });

  const { data: epochBudget } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "epochBudget",
  });

  const { data: epochSpent } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "epochSpent",
  });

  const { data: minDelay } = useReadContract({
    address: CONTRACTS.TimelockController as `0x${string}`,
    abi: ABIS.TimelockController,
    functionName: "getMinDelay",
  });

  const { data: governorToken } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "token",
  });

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">System Overview</h1>
          <p className="mt-2 text-slate-600">查看链上关键合约地址、治理参数与 Treasury 状态。</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="KnowledgeContent">
            <div className="space-y-2 text-sm text-slate-600">
              <div className="break-all">Address: {CONTRACTS.KnowledgeContent}</div>
              <div className="break-all">Owner: {String(contentOwner ?? "-")}</div>
              <div className="break-all">VotesContract: {String(votesContract ?? "-")}</div>
              <div className="break-all">Treasury: {String(treasury ?? "-")}</div>
            </div>
          </SectionCard>

          <SectionCard title="TreasuryNative">
            <div className="space-y-2 text-sm text-slate-600">
              <div className="break-all">Address: {CONTRACTS.TreasuryNative}</div>
              <div className="break-all">Owner: {String(treasuryOwner ?? "-")}</div>
              <div>EpochBudget: {epochBudget ? formatEther(epochBudget as bigint) : "0"} BESU</div>
              <div>EpochSpent: {epochSpent ? formatEther(epochSpent as bigint) : "0"} BESU</div>
            </div>
          </SectionCard>

          <SectionCard title="Governor">
            <div className="space-y-2 text-sm text-slate-600">
              <div className="break-all">Address: {CONTRACTS.KnowledgeGovernor}</div>
              <div className="break-all">Token: {String(governorToken ?? "-")}</div>
            </div>
          </SectionCard>

          <SectionCard title="Timelock">
            <div className="space-y-2 text-sm text-slate-600">
              <div className="break-all">Address: {CONTRACTS.TimelockController}</div>
              <div>MinDelay: {minDelay ? String(minDelay) : "-"} 秒</div>
            </div>
          </SectionCard>
        </div>
      </main>
    </div>
  );
}