"use client";

import { useReadContract } from "wagmi";
import { Navbar } from "@/components/navbar";
import { useWalletReady } from "@/hooks/useWalletReady";
import { ABIS, CONTRACTS } from "@/contracts";
import { formatEther } from "viem";
import { StatCard } from "@/components/stat-card";
import { BookOpen, Coins, ShieldCheck, Wallet } from "lucide-react";

export default function HomePage() {
  const { address, isConnected, isCorrectChain } = useWalletReady();

  const { data: epochBudget } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "epochBudget",
  });

  const { data: contentCount } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "contentCount",
  });

  const { data: myVotes } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "getVotes",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: myPendingRewards } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "pendingRewards",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Besu QBFT · DAO Governance · Native Treasury
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950">
              Knowledge DApp Dashboard
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              一个基于 Besu 联盟链构建的去中心化知识协作与激励平台，支持质押投票、内容确权、模块化金库发奖与 DAO 治理。
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="钱包状态"
            value={isConnected ? "已连接" : "未连接"}
            description={isConnected ? "钱包已成功接入当前站点" : "请先连接 MetaMask"}
            icon={<Wallet className="h-5 w-5" />}
          />
          <StatCard
            title="网络状态"
            value={isCorrectChain ? "Besu 联盟链" : "网络不正确"}
            description={isCorrectChain ? "当前已连接到本地 Besu 链" : "请切换到 Besu 网络"}
            icon={<ShieldCheck className="h-5 w-5" />}
          />
          <StatCard
            title="我的投票权"
            value={`${myVotes ? formatEther(myVotes as bigint) : "0"} BESU`}
            description="已激活的质押投票权"
            icon={<Coins className="h-5 w-5" />}
          />
          <StatCard
            title="我的待领取奖励"
            value={`${myPendingRewards ? formatEther(myPendingRewards as bigint) : "0"} BESU`}
            description="来自 Treasury 的待领取金额"
            icon={<Coins className="h-5 w-5" />}
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <StatCard
            title="内容总数"
            value={contentCount ? String(contentCount) : "0"}
            description="当前链上已注册的知识内容数量"
            icon={<BookOpen className="h-5 w-5" />}
          />
          <StatCard
            title="当前 Treasury Budget"
            value={`${epochBudget ? formatEther(epochBudget as bigint) : "0"} BESU`}
            description="当前预算周期可分配奖励上限"
            icon={<Coins className="h-5 w-5" />}
          />
          <StatCard
            title="当前地址"
            value={address ?? "未连接"}
            description="当前连接的钱包地址"
            icon={<Wallet className="h-5 w-5" />}
          />
        </div>
      </main>
    </div>
  );
}