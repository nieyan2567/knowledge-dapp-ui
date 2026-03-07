"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Navbar() {
  return (
    <div className="w-full border-b px-6 py-4 flex items-center justify-between">
      <div className="flex gap-6 text-sm font-medium">
        <Link href="/">Dashboard</Link>
        <Link href="/stake">Stake</Link>
        <Link href="/content">Content</Link>
        <Link href="/rewards">Rewards</Link>
        <Link href="/governance">Governance</Link>
        <Link href="/system">System</Link>
      </div>
      <ConnectButton />
    </div>
  );
}