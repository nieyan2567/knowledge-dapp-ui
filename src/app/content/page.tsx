"use client";

import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { Navbar } from "@/components/navbar";
import { CONTRACTS, ABIS } from "@/contracts";

export default function ContentPage() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [ipfsHash, setIpfsHash] = useState("");

  async function handleRegister() {
    if (!address || !ipfsHash) return;

    await writeContractAsync({
      address: CONTRACTS.KnowledgeContent as `0x${string}`,
      abi: ABIS.KnowledgeContent,
      functionName: "registerContent",
      args: [ipfsHash],
      account: address,
    });
  }

  return (
    <div>
      <Navbar />
      <main className="p-8 space-y-6">
        <h1 className="text-2xl font-bold">Content</h1>

        <div className="border rounded-xl p-4 max-w-xl space-y-4">
          <div className="text-sm text-gray-500">
            这里先手动输入 IPFS Hash，后面再接入 IPFS 上传接口
          </div>

          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="输入 IPFS Hash"
            value={ipfsHash}
            onChange={(e) => setIpfsHash(e.target.value)}
          />

          <button
            onClick={handleRegister}
            className="px-4 py-2 rounded bg-black text-white"
          >
            Register Content
          </button>
        </div>
      </main>
    </div>
  );
}