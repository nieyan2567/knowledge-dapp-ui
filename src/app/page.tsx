"use client";

import { Navbar } from "@/components/navbar";
import { useWalletReady } from "@/hooks/useWalletReady";

export default function HomePage() {
  const { address, isConnected, isCorrectChain } = useWalletReady();

  return (
    <div>
      <Navbar />
      <main className="p-8 space-y-6">
        <h1 className="text-3xl font-bold">Knowledge DApp Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-xl p-4">
            <div className="text-sm text-gray-500">钱包状态</div>
            <div className="mt-2 font-medium">
              {isConnected ? "已连接" : "未连接"}
            </div>
          </div>

          <div className="border rounded-xl p-4">
            <div className="text-sm text-gray-500">网络状态</div>
            <div className="mt-2 font-medium">
              {isCorrectChain ? "已连接 Besu 联盟链" : "网络不正确"}
            </div>
          </div>

          <div className="border rounded-xl p-4">
            <div className="text-sm text-gray-500">当前地址</div>
            <div className="mt-2 font-medium break-all">
              {address ?? "未连接"}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}