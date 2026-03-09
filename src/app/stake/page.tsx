"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Navbar } from "@/components/navbar";
import { CONTRACTS, ABIS } from "@/contracts";
import { SectionCard } from "@/components/section-card";

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
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Stake & Voting Power</h1>
          <p className="mt-2 text-slate-600">先质押原生币，再激活投票权，才能参与内容投票和 DAO 治理。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">投票权</div>
            <div className="mt-2 text-2xl font-semibold">{votes ? formatEther(votes as bigint) : "0"} BESU</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">已激活质押</div>
            <div className="mt-2 text-2xl font-semibold">{staked ? formatEther(staked as bigint) : "0"} BESU</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">待激活质押</div>
            <div className="mt-2 text-2xl font-semibold">{pendingStake ? formatEther(pendingStake as bigint) : "0"} BESU</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">待提取金额</div>
            <div className="mt-2 text-2xl font-semibold">{pendingWithdraw ? formatEther(pendingWithdraw as bigint) : "0"} BESU</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Deposit / Activate"
            description="质押后需要等待激活区块数，再点击 Activate 才会获得投票权。"
          >
            <div className="space-y-4">
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="输入质押数量"
              />
              <div className="flex gap-3">
                <button onClick={handleDeposit} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                  Deposit
                </button>
                <button onClick={handleActivate} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Activate
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Withdraw"
            description="先申请退出，再等待冷却期结束后完成提现。"
          >
            <div className="space-y-4">
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="输入提取数量"
              />
              <div className="flex gap-3">
                <button onClick={handleRequestWithdraw} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Request Withdraw
                </button>
                <button onClick={handleWithdraw} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
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