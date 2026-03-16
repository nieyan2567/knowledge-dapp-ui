"use client";

import { formatEther } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { CONTRACTS, ABIS } from "@/contracts";
import { SectionCard } from "@/components/section-card";
import { PageHeader } from "@/components/page-header";
import { Coins, Wallet, ShieldCheck } from "lucide-react";

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
    <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
      <PageHeader
        eyebrow="Treasury · Claimable Rewards"
        title="Rewards Center"
        description="奖励由 Treasury 统一记账与发放。作者在内容达到奖励门槛并完成记账后，可在这里主动领取奖励。"
      />

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "待领取奖励",
            value: `${pendingRewards ? formatEther(pendingRewards as bigint) : "0"} KC`,
            desc: "当前账户在 Treasury 中的待领取金额",
            icon: <Wallet className="h-5 w-5 text-slate-400 dark:text-slate-500" />,
          },
          {
            label: "当前 Epoch Budget",
            value: `${epochBudget ? formatEther(epochBudget as bigint) : "0"} KC`,
            desc: "当前预算周期内的总奖励上限",
            icon: <Coins className="h-5 w-5 text-slate-400 dark:text-slate-500" />,
          },
          {
            label: "当前 Epoch 已使用",
            value: `${epochSpent ? formatEther(epochSpent as bigint) : "0"} KC`,
            desc: "当前预算周期内已分配的奖励金额",
            icon: <ShieldCheck className="h-5 w-5 text-slate-400 dark:text-slate-500" />,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400">{item.label}</div>
              {item.icon}
            </div>
            <div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
              {item.value}
            </div>
            <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {item.desc}
            </div>
          </div>
        ))}
      </section>

      <SectionCard
        title="Claim Rewards"
        description="当你的内容奖励已经被记入 Treasury 后，点击下方按钮即可把奖励提取到当前钱包。"
      >
        <button
          onClick={handleClaim}
          className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Claim Reward
        </button>
      </SectionCard>
    </main>
  );
}