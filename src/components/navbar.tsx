"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BookOpen, Coins, LayoutDashboard, Shield, Vote, Wallet } from "lucide-react";
import { useWalletReady } from "@/hooks/useWalletReady";
import { besuChain } from "@/lib/chains";
import clsx from "clsx";
import { usePathname } from "next/navigation";

function toHexChainId(id: number) {
  return `0x${id.toString(16)}`;
}

async function addOrSwitchBesuChain() {
  const ethereum = (window as any).ethereum;
  if (!ethereum) return;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: toHexChainId(besuChain.id) }],
    });
  } catch (error: any) {
    if (error?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: toHexChainId(besuChain.id),
            chainName: besuChain.name,
            rpcUrls: besuChain.rpcUrls.default.http,
            nativeCurrency: besuChain.nativeCurrency,
            blockExplorerUrls: besuChain.blockExplorers?.default?.url
              ? [besuChain.blockExplorers.default.url]
              : [],
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stake", label: "Stake", icon: Wallet },
  { href: "/content", label: "Content", icon: BookOpen },
  { href: "/rewards", label: "Rewards", icon: Coins },
  { href: "/governance", label: "Governance", icon: Vote },
  { href: "/system", label: "System", icon: Shield },
];

export function Navbar() {
  const { isCorrectChain } = useWalletReady();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-slate-500">Knowledge DApp</div>
            <div className="text-base font-semibold text-slate-900">Decentralized Collaboration</div>
          </div>
        </div>

        <nav className="hidden items-center gap-2 lg:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {!isCorrectChain && (
            <button
              onClick={addOrSwitchBesuChain}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              切换到 Besu
            </button>
          )}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}