"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Navbar } from "@/components/navbar";
import { CONTRACTS, ABIS } from "@/contracts";
import { SectionCard } from "@/components/section-card";
import { PageHeader } from "@/components/page-header";
import { Coins, Wallet, Clock3, ShieldCheck } from "lucide-react";
import { BRANDING } from "@/lib/branding";

export default function StakePage() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [depositAmount, setDepositAmount] = useState("1");
  const [withdrawAmount, setWithdrawAmount] = useState("1");

  const { data: votes } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "getVotes",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: staked } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "staked",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: pendingStake } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "pendingStake",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: pendingWithdraw } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "pendingWithdraw",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  async function handleDeposit() {
    if (!address) return;
    await writeContractAsync({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "deposit",
      value: parseEther(depositAmount),
      account: address,
    });
  }

  async function handleActivate() {
    if (!address) return;
    await writeContractAsync({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "activate",
      account: address,
    });
  }

  async function handleRequestWithdraw() {
    if (!address) return;
    await writeContractAsync({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "requestWithdraw",
      args: [parseEther(withdrawAmount)],
      account: address,
    });
  }

  async function handleWithdraw() {
    if (!address) return;
    await writeContractAsync({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "withdraw",
      args: [parseEther(withdrawAmount)],
      account: address,
    });
  }

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <PageHeader
          eyebrow="Staking · Voting Power"
          title="Stake & Voting Power"
          description="用户先质押原生币，再激活投票权，才能参与内容投票和 DAO 治理。退出质押时需要先申请，再等待冷却期结束。"
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">投票权</div>
              <ShieldCheck className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-950">
              {votes ? formatEther(votes as bigint) : "0"} {BRANDING.nativeTokenSymbol}
            </div>
            <div className="mt-3 text-sm text-slate-500">已激活的有效投票权</div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">已激活质押</div>
              <Coins className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-950">
              {staked ? formatEther(staked as bigint) : "0"} {BRANDING.nativeTokenSymbol}
            </div>
            <div className="mt-3 text-sm text-slate-500">当前已生效的质押余额</div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">待激活质押</div>
              <Clock3 className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-950">
              {pendingStake ? formatEther(pendingStake as bigint) : "0"} {BRANDING.nativeTokenSymbol}
            </div>
            <div className="mt-3 text-sm text-slate-500">等待区块确认后可激活</div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">待提取金额</div>
              <Wallet className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-950">
              {pendingWithdraw ? formatEther(pendingWithdraw as bigint) : "0"} {BRANDING.nativeTokenSymbol}
            </div>
            <div className="mt-3 text-sm text-slate-500">冷却期后可执行提现</div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Deposit / Activate"
            description="先发起 Deposit，把原生币锁进合约；等到激活区块数达到后，再点击 Activate 获得投票权。"
          >
            <div className="space-y-4">
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="输入质押数量，例如 1"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDeposit}
                  className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Deposit
                </button>
                <button
                  onClick={handleActivate}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Activate
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Request Withdraw / Withdraw"
            description="先申请退出，系统会立即减少你的投票权；等冷却期结束后，再执行 Withdraw 提取原生币。"
          >
            <div className="space-y-4">
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="输入提取数量，例如 1"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleRequestWithdraw}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Request Withdraw
                </button>
                <button
                  onClick={handleWithdraw}
                  className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </main>
    </div>
  );
}