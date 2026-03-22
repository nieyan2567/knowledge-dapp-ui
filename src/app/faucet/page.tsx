"use client";

import Link from "next/link";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBalance, useSignMessage } from "wagmi";
import { formatEther } from "viem";
import {
  ArrowRight,
  Coins,
  Droplets,
  ExternalLink,
  FileText,
  ShieldCheck,
  Sparkles,
  Vote,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme-toggle";
import { buildFaucetClaimMessage, type FaucetAuthChallenge } from "@/lib/faucet/message";
import { useWalletReady } from "@/hooks/useWalletReady";
import { BRANDING } from "@/lib/branding";

type FaucetClaimResponse = {
  ok?: boolean;
  txHash?: `0x${string}`;
  amount?: string;
  displayAmount?: string;
  address?: `0x${string}`;
  error?: string;
};

type FaucetNonceError = {
  error?: string;
};

function isUserRejectedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  const message = `${(error as { shortMessage?: string }).shortMessage ?? ""} ${
    (error as { message?: string }).message ?? ""
  }`.toLowerCase();

  return (
    code === 4001 ||
    code === "ACTION_REJECTED" ||
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("rejected the request") ||
    message.includes("denied message signature")
  );
}

function ConnectAction() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted;
        const connected = ready && !!account && !!chain;

        if (!ready) {
          return (
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-400 opacity-70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
              disabled
            >
              Loading wallet...
            </button>
          );
        }

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Connect wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
            >
              Wrong network
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={openAccountModal}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

export default function FaucetPage() {
  const { address, isConnected, isCorrectChain } = useWalletReady();
  const { signMessageAsync } = useSignMessage();
  const { data: balance } = useBalance({
    address,
    query: { enabled: !!address },
  });

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [claimAmount, setClaimAmount] = useState<string | null>(null);

  async function handleClaim() {
    if (!address || !isConnected) {
      toast.error("请先连接钱包");
      return;
    }

    if (!isCorrectChain) {
      toast.error(`请先切换到 ${BRANDING.chainName}`);
      return;
    }

    setLoading(true);
    setTxHash(null);

    try {
      const nonceRes = await fetch(`/api/faucet/nonce?address=${encodeURIComponent(address)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });

      const nonceData = (await nonceRes.json()) as FaucetAuthChallenge | FaucetNonceError;

      if (!nonceRes.ok || !("nonce" in nonceData)) {
        toast.error(("error" in nonceData && nonceData.error) || "创建 Faucet 签名挑战失败");
        return;
      }

      const signature = await signMessageAsync({
        message: buildFaucetClaimMessage(nonceData, address),
      });

      const claimRes = await fetch("/api/faucet/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          address,
          nonce: nonceData.nonce,
          signature,
        }),
      });

      const claimData = (await claimRes.json()) as FaucetClaimResponse;

      if (!claimRes.ok || !claimData.ok || !claimData.txHash) {
        toast.error(claimData.error || "Faucet 发放失败，请稍后再试");
        return;
      }

      setTxHash(claimData.txHash);
      setClaimAmount(claimData.displayAmount || null);
      toast.success("启动资金已发放");
    } catch (error) {
      if (isUserRejectedError(error)) {
        toast.info("已取消钱包签名");
        return;
      }

      toast.error(error instanceof Error ? error.message : "Faucet 请求失败");
    } finally {
      setLoading(false);
    }
  }

  const walletBalanceText = balance
    ? `${formatEther(balance.value)} ${balance.symbol}`
    : "--";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.08),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.14),transparent_24%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-6 py-8 text-slate-900 dark:bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.12),transparent_26%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.16),transparent_24%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back to app
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <ConnectAction />
          </div>
        </div>

        <section className="grid gap-8 pt-12 lg:grid-cols-[minmax(0,1.15fr)_420px] lg:items-start">
          <div className="space-y-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                <Droplets className="h-4 w-4" />
                {BRANDING.chainName} Starter Faucet
              </div>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-6xl">
                  Get starter {BRANDING.nativeTokenSymbol} for your first on-chain actions
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                  This faucet gives new wallets a small amount of {BRANDING.nativeTokenSymbol} so they can
                  pay gas, upload content, vote, and claim rewards inside {BRANDING.appName}.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200">
                  <Wallet className="h-4 w-4 text-slate-400" />
                  Wallet balance: {walletBalanceText}
                </div>
                <a
                  href={BRANDING.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 backdrop-blur transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Open Explorer
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
                <ShieldCheck className="mb-4 h-5 w-5 text-emerald-500" />
                <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">Wallet signature only</div>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  You only sign a message to request funds. The faucet server sends the starter funds.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
                <Sparkles className="mb-4 h-5 w-5 text-blue-500" />
                <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">Built for first actions</div>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  The starter grant is intended for gas and your first vote, upload, reward claim, or stake flow.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
                <Coins className="mb-4 h-5 w-5 text-violet-500" />
                <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">Cooldown protected</div>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Repeated claims are rate-limited, and wallets that already have enough gas may be rejected.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-[0_24px_80px_rgba(2,6,23,0.6)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Request starter funds</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-100">
                  {BRANDING.nativeTokenSymbol} Faucet
                </div>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Droplets className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Connected wallet
                </div>
                <div className="mt-2 break-all text-sm font-medium text-slate-900 dark:text-slate-100">
                  {address || "Connect your wallet to request funds"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Chain
                </div>
                <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {BRANDING.chainName}
                </div>
              </div>

              <button
                type="button"
                onClick={handleClaim}
                disabled={!isConnected || !isCorrectChain || loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <Droplets className="h-4 w-4" />
                {loading ? "Requesting starter funds..." : `Request ${BRANDING.nativeTokenSymbol}`}
              </button>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                The faucet is for new wallets that need enough gas to begin using {BRANDING.appName}. If your wallet
                already has enough {BRANDING.nativeTokenSymbol}, the request may be rejected.
              </div>

              {txHash ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    Starter funds sent{claimAmount ? `: ${claimAmount}` : ""}
                  </div>
                  <a
                    href={`${BRANDING.explorerUrl}/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 break-all text-sm text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                  >
                    {txHash}
                    <ExternalLink className="h-4 w-4 shrink-0" />
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center gap-3 text-slate-950 dark:text-slate-100">
              <Vote className="h-5 w-5" />
              <h2 className="text-lg font-semibold">What you can do next</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <li>Use the first grant to pay gas for your first vote.</li>
              <li>Upload content to IPFS and register it on-chain.</li>
              <li>Claim accrued rewards or activate your first stake.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center gap-3 text-slate-950 dark:text-slate-100">
              <FileText className="h-5 w-5" />
              <h2 className="text-lg font-semibold">How it works</h2>
            </div>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <li>Connect a wallet on {BRANDING.chainName}.</li>
              <li>Sign a faucet request message.</li>
              <li>The backend verifies the signature and sends starter funds.</li>
            </ol>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center gap-3 text-slate-950 dark:text-slate-100">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Rules</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <li>Requests are rate-limited per wallet and IP.</li>
              <li>Only wallets on {BRANDING.chainName} are accepted.</li>
              <li>Requests may be rejected if the wallet already has enough gas.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
