"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Navbar } from "@/components/navbar";
import { CONTRACTS, ABIS } from "@/contracts";
import { ContentCard } from "@/components/content-card";
import { SectionCard } from "@/components/section-card";

export default function ContentPage() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [ipfsHash, setIpfsHash] = useState("");

  const { data: contentCount } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "contentCount",
  });

  const ids = useMemo(() => {
    const total = Number(contentCount ?? 0n);
    return Array.from({ length: total }, (_, i) => i + 1).reverse();
  }, [contentCount]);

  async function handleRegister() {
    if (!address || !ipfsHash) return;

    await writeContractAsync({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "registerContent",
      args: [ipfsHash],
      account: address,
    });

    setIpfsHash("");
  }

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Content Hub</h1>
          <p className="mt-2 text-slate-600">上传知识内容、浏览链上注册记录，并通过社区投票完成质量评价与奖励分配。</p>
        </div>

        <SectionCard
          title="Register Content"
          description="当前版本先手动输入 IPFS Hash；下一步可接入 Pinata 或你自己的 IPFS 上传接口。"
        >
          <div className="flex flex-col gap-4 md:flex-row">
            <input
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              placeholder="输入 IPFS Hash"
              value={ipfsHash}
              onChange={(e) => setIpfsHash(e.target.value)}
            />
            <button
              onClick={handleRegister}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Register Content
            </button>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">内容列表</h2>
            <div className="text-sm text-slate-500">共 {ids.length} 条内容</div>
          </div>

          {ids.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              暂无内容，请先上传并注册第一条内容。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ids.map((id) => (
                <ContentCard key={id} id={id} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}