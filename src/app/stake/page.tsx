"use client";

import { useState } from "react";
import { parseEther, formatEther } from "viem";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { Navbar } from "@/components/navbar";
import { CONTRACTS, ABIS } from "@/contracts";

export default function StakePage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("1");

  const { data: votes } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "getVotes",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  async function handleDeposit() {
    if (!walletClient || !address) return;

    await writeContractAsync({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "deposit",
      value: parseEther(amount),
      account: address,
    });
  }

  async function handleActivate() {
    if (!walletClient || !address) return;

    await writeContractAsync({
      address: CONTRACTS.NativeVotes as `0x${string}`,
      abi: ABIS.NativeVotes,
      functionName: "activate",
      account: address,
    });
  }

  return (
    <div>
      <Navbar />
      <main className="p-8 space-y-6">
        <h1 className="text-2xl font-bold">Stake / Voting Power</h1>

        <div className="border rounded-xl p-4 space-y-4 max-w-xl">
          <div>
            <div className="text-sm text-gray-500">当前投票权</div>
            <div className="text-lg font-semibold">
              {votes ? formatEther(votes as bigint) : "0"} BESU
            </div>
          </div>

          <input
            className="border rounded px-3 py-2 w-full"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="输入质押数量"
          />

          <div className="flex gap-3">
            <button
              onClick={handleDeposit}
              className="px-4 py-2 rounded bg-black text-white"
            >
              Deposit
            </button>

            <button
              onClick={handleActivate}
              className="px-4 py-2 rounded border"
            >
              Activate
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}