"use client";

/**
 * 模块说明：Faucet 页面分区组件集合，负责渲染顶部连接按钮、Hero 区、领取卡片和说明网格。
 */
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
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

import { ThemeToggle } from "@/components/theme-toggle";
import { useEnsureKnowledgeChain } from "@/hooks/useEnsureKnowledgeChain";
import { BRANDING } from "@/lib/branding";
import { FAUCET_COPY, getFaucetSuccessTitle } from "@/lib/faucet/copy";

/**
 * 渲染 Faucet 页面顶部的钱包连接动作区。
 * @returns 根据连接状态动态切换的钱包操作按钮。
 */
export function ConnectAction() {
  const { ensureChain, hasWalletRequest, isSwitching } = useEnsureKnowledgeChain({
    errorMessage: `切换到 ${BRANDING.chainName} 失败，请重试`,
  });

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
              {FAUCET_COPY.page.loadingWallet}
            </button>
          );
        }

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {FAUCET_COPY.page.connectWallet}
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={() => {
                if (!hasWalletRequest) {
                  openChainModal();
                  return;
                }

                void ensureChain();
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
            >
              {isSwitching
                ? `切换到 ${BRANDING.chainName}...`
                : FAUCET_COPY.page.wrongNetwork}
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

/**
 * 渲染 Faucet 功能亮点卡片。
 * @param icon 卡片图标。
 * @param title 卡片标题。
 * @param description 卡片说明。
 * @returns 功能亮点卡片。
 */
function FaucetFeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mb-4">{icon}</div>
      <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

/**
 * 渲染 Faucet Hero 区。
 * @param walletBalanceText 当前钱包余额文本。
 * @returns Faucet 页面顶部介绍区。
 */
export function FaucetHeroSection({
  walletBalanceText,
}: {
  walletBalanceText: string;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Droplets className="h-4 w-4" />
          {FAUCET_COPY.page.heroEyebrow}
        </div>

        <div className="space-y-4">
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-6xl">
            {FAUCET_COPY.page.heroTitle}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            {FAUCET_COPY.page.heroDescription}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200">
            <Wallet className="h-4 w-4 text-slate-400" />
            {FAUCET_COPY.page.walletBalanceLabel}: {walletBalanceText}
          </div>
          <a
            href={BRANDING.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 backdrop-blur transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            {FAUCET_COPY.page.openExplorer}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FaucetFeatureCard
          icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
          title={FAUCET_COPY.page.signatureCardTitle}
          description={FAUCET_COPY.page.signatureCardDescription}
        />
        <FaucetFeatureCard
          icon={<Sparkles className="h-5 w-5 text-blue-500" />}
          title={FAUCET_COPY.page.firstActionCardTitle}
          description={FAUCET_COPY.page.firstActionCardDescription}
        />
        <FaucetFeatureCard
          icon={<Coins className="h-5 w-5 text-violet-500" />}
          title={FAUCET_COPY.page.cooldownCardTitle}
          description={FAUCET_COPY.page.cooldownCardDescription}
        />
      </div>
    </div>
  );
}

/**
 * 渲染 Faucet 领取操作卡片。
 * @param address 当前连接地址。
 * @param isConnected 当前是否已连接钱包。
 * @param isCorrectChain 当前是否处于正确链。
 * @param loading 是否正在领取。
 * @param txHash 最近一次领取交易哈希。
 * @param claimAmount 最近一次领取金额。
 * @param onClaim 触发领取回调。
 * @returns Faucet 领取操作卡片。
 */
export function FaucetRequestCard({
  address,
  isConnected,
  isCorrectChain,
  loading,
  txHash,
  claimAmount,
  onClaim,
}: {
  address?: `0x${string}`;
  isConnected: boolean;
  isCorrectChain: boolean;
  loading: boolean;
  txHash: `0x${string}` | null;
  claimAmount: string | null;
  onClaim: () => void;
}) {
  return (
    <div className="rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-[0_24px_80px_rgba(2,6,23,0.6)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {FAUCET_COPY.page.requestFundsLabel}
          </div>
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
            {FAUCET_COPY.page.connectedWalletLabel}
          </div>
          <div className="mt-2 break-all text-sm font-medium text-slate-900 dark:text-slate-100">
            {address || FAUCET_COPY.page.disconnectedWalletHint}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {FAUCET_COPY.page.chainLabel}
          </div>
          <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            {BRANDING.chainName}
          </div>
        </div>

        <button
          type="button"
          data-testid="faucet-claim-button"
          onClick={onClaim}
          disabled={!isConnected || !isCorrectChain || loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          <Droplets className="h-4 w-4" />
          {loading
            ? FAUCET_COPY.page.claimButtonLoading
            : FAUCET_COPY.page.claimButtonIdle}
        </button>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
          {FAUCET_COPY.page.helperText}
        </div>

        {txHash ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              {getFaucetSuccessTitle(claimAmount)}
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
  );
}

/**
 * 渲染 Faucet 说明信息网格。
 * @returns Faucet 规则与说明网格。
 */
export function FaucetInfoGrid() {
  return (
    <section className="mt-16 grid gap-6 lg:grid-cols-3">
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-3 text-slate-950 dark:text-slate-100">
          <Vote className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{FAUCET_COPY.page.nextStepsTitle}</h2>
        </div>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {FAUCET_COPY.page.nextSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-3 text-slate-950 dark:text-slate-100">
          <FileText className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{FAUCET_COPY.page.workflowTitle}</h2>
        </div>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {FAUCET_COPY.page.workflow.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-3 text-slate-950 dark:text-slate-100">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{FAUCET_COPY.page.rulesTitle}</h2>
        </div>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {FAUCET_COPY.page.rules.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * 渲染 Faucet 页面顶部工具栏。
 * @returns 包含主题切换、钱包连接和导航链接的顶栏。
 */
export function FaucetPageTopbar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
      >
        <ArrowRight className="h-4 w-4 rotate-180" />
        {FAUCET_COPY.page.backToApp}
      </Link>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <ConnectAction />
      </div>
    </div>
  );
}
