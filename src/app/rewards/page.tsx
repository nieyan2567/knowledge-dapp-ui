"use client";

import { Coins, ShieldCheck, Wallet } from "lucide-react";
import { formatEther } from "viem";
import { toast } from "sonner";
import { useAccount, useReadContract, useWriteContract } from "wagmi";

// import { Navbar } from "@/components/navbar";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import { txToast } from "@/lib/tx-toast";

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
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    await txToast(
      writeContractAsync({
        address: CONTRACTS.TreasuryNative as `0x${string}`,
        abi: ABIS.TreasuryNative,
        functionName: "claim",
        account: address,
      }),
      "正在提交领取奖励交易...",
      "领取奖励交易已提交",
      "领取奖励失败"
    );
  }

  return (
    <div>
      {/* <Navbar /> */}
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <PageHeader
          eyebrow="Treasury · Claimable Rewards"
          title="Rewards Center"
          description="Claim rewards that have already been accrued in Treasury for the connected wallet."
        />

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">Pending Rewards</div>
              <Wallet className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-950">
              {pendingRewards ? formatEther(pendingRewards as bigint) : "0"}{" "}
              {BRANDING.nativeTokenSymbol}
            </div>
            <div className="mt-3 text-sm text-slate-500">
              Rewards currently available to claim from Treasury.
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">Epoch Budget</div>
              <Coins className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-950">
              {epochBudget ? formatEther(epochBudget as bigint) : "0"}{" "}
              {BRANDING.nativeTokenSymbol}
            </div>
            <div className="mt-3 text-sm text-slate-500">
              Total reward budget allocated to the current epoch.
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">Epoch Spent</div>
              <ShieldCheck className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-950">
              {epochSpent ? formatEther(epochSpent as bigint) : "0"}{" "}
              {BRANDING.nativeTokenSymbol}
            </div>
            <div className="mt-3 text-sm text-slate-500">
              Reward amount already distributed in the current epoch.
            </div>
          </div>
        </section>

        <SectionCard
          title="Claim Rewards"
          description="Use this action after your rewards have been recorded into Treasury."
        >
          <button
            onClick={handleClaim}
            className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Claim Reward
          </button>
        </SectionCard>
      </main>
    </div>
  );
}
