"use client";

import { useEffect } from "react";
import { useReadContract } from "wagmi";
import { useWalletReady } from "@/hooks/useWalletReady";
import { ABIS, CONTRACTS } from "@/contracts";
import { formatEther } from "viem";
import { StatCard } from "@/components/stat-card";
import { BookOpen, Coins, ShieldCheck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AddressBadge } from "@/components/address-badge";
import { subscribeTxConfirmed } from "@/lib/tx-events";
import { BRANDING } from "@/lib/branding";
import { asBigInt } from "@/lib/web3-types";

export default function HomePage() {
  const { address, isConnected, isCorrectChain } = useWalletReady();

  const { data: epochBudget, refetch: refetchEpochBudget } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "epochBudget",
  });

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
	
	const epochBudgetValue = asBigInt(epochBudget);
  const contentCountValue = asBigInt(contentCount);
  const myVotesValue = asBigInt(myVotes);
  const myPendingRewardsValue = asBigInt(myPendingRewards);

  useEffect(() => {
    return subscribeTxConfirmed(({ domains }) => {
      if (!domains.some((domain) => ["stake", "rewards", "content", "dashboard"].includes(domain))) {
        return;
      }

      void Promise.all([
        refetchEpochBudget(),
        refetchContentCount(),
        refetchMyVotes(),
        refetchMyPendingRewards(),
      ]);
    });
  }, [
    refetchContentCount,
    refetchEpochBudget,
    refetchMyPendingRewards,
    refetchMyVotes,
  ]);

  return (
    <div>
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <PageHeader
            eyebrow="KnowChain · DAO Governance · Native Treasury"
            title="Knowledge DApp Dashboard"
            description="一个基于 KnowChain 构建的去中心化知识协作与激励平台，支持质押投票、内容确权、模块化金库发奖与 DAO 治理。"
          />
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="钱包状态"
            value={isConnected ? "已连接" : "未连接"}
            description={isConnected ? "钱包已成功接入当前站点" : "请先连接 MetaMask"}
            icon={<Wallet className="h-5 w-5" />}
          />
          <StatCard
            title="网络状态"
            value={isCorrectChain ? "KnowChain" : "网络不正确"}
            description={isCorrectChain ? "当前已连接到本地 KnowChain" : "请切换到 KnowChain"}
            icon={<ShieldCheck className="h-5 w-5" />}
          />
          <StatCard
            title="我的投票权"
            value={`${myVotesValue ? formatEther(myVotesValue) : "0"} ${BRANDING.nativeTokenSymbol}`}
            description="已激活的质押投票权"
            icon={<Coins className="h-5 w-5" />}
          />
          <StatCard
            title="我的待领取奖励"
            value={`${myPendingRewardsValue ? formatEther(myPendingRewardsValue) : "0"} ${BRANDING.nativeTokenSymbol}`}
            description="来自 Treasury 的待领取金额"
            icon={<Coins className="h-5 w-5" />}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="内容总数"
            value={contentCountValue ? String(contentCountValue) : "0"}
            description="当前链上已注册的知识内容数量"
            icon={<BookOpen className="h-5 w-5" />}
          />
          <StatCard
            title="当前 Treasury Budget"
            value={`${epochBudgetValue ? formatEther(epochBudgetValue) : "0"} ${BRANDING.nativeTokenSymbol}`}
            description="当前预算周期可分配奖励上限"
            icon={<Coins className="h-5 w-5" />}
          />
          <StatCard
            title="当前地址"
            value={<AddressBadge address={address} />}
            description="当前连接的钱包地址"
            icon={<Wallet className="h-5 w-5" />}
          />
        </section>
      </main>
    </div>
  );
}
