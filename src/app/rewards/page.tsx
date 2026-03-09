"use client";

import { formatEther } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Navbar } from "@/components/navbar";
import { CONTRACTS, ABIS } from "@/contracts";
import { SectionCard } from "@/components/section-card";

export default function RewardsPage() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const { data: pendingRewards } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "pendingRewards",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
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

  async function handleClaim() {
    if (!address) return;

    await writeContractAsync({
      address: CONTRACTS.TreasuryNative as `0x${string}`,
      abi: ABIS.TreasuryNative,
      functionName: "claim",
      account: address,
    });
  }

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Rewards Center</h1>
          <p className="mt-2 text-slate-600">奖励由 Treasury 统一记账与发放，作者在此领取待结算奖励。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">待领取奖励</div>
            <div className="mt-2 text-2xl font-semibold">{pendingRewards ? formatEther(pendingRewards as bigint) : "0"} BESU</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">当前 Epoch Budget</div>
            <div className="mt-2 text-2xl font-semibold">{epochBudget ? formatEther(epochBudget as bigint) : "0"} BESU</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">当前 Epoch 已使用</div>
            <div className="mt-2 text-2xl font-semibold">{epochSpent ? formatEther(epochSpent as bigint) : "0"} BESU</div>
          </div>
        </div>

        <SectionCard
          title="Claim Rewards"
          description="当内容奖励被记入 Treasury 后，作者可在这里主动领取。"
        >
          <button
            onClick={handleClaim}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Claim Reward
          </button>
        </SectionCard>
      </main>
    </div>
  );
}