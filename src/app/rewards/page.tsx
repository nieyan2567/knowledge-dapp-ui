"use client";

import { formatEther } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { Navbar } from "@/components/navbar";
import { CONTRACTS, ABIS } from "@/contracts";

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
      <main className="p-8 space-y-6">
        <h1 className="text-2xl font-bold">Rewards</h1>

        <div className="border rounded-xl p-4 max-w-xl space-y-4">
          <div>
            <div className="text-sm text-gray-500">待领取奖励</div>
            <div className="text-lg font-semibold">
              {pendingRewards ? formatEther(pendingRewards as bigint) : "0"} BESU
            </div>
          </div>

          <button
            onClick={handleClaim}
            className="px-4 py-2 rounded bg-black text-white"
          >
            Claim Reward
          </button>
        </div>
      </main>
    </div>
  );
}