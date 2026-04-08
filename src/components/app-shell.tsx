"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coins,
  Droplets,
  ExternalLink,
  LayoutDashboard,
  LockKeyhole,
  Shield,
  UserRound,
  Vote,
  Wallet,
} from "lucide-react";
import clsx from "clsx";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  APP_SHELL_COPY,
  EXTERNAL_NAV_ITEMS,
  getPageTitle,
  INTERNAL_NAV_ITEMS,
} from "@/lib/app-shell-config";
import { BRANDING } from "@/lib/branding";

const EXPANDED_WIDTH = 272;
const COLLAPSED_WIDTH = 88;

const topbarButtonClass =
  "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium shadow-sm transition";
const neutralButtonClass =
  "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const dangerButtonClass =
  "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60";

const iconMap = {
  dashboard: LayoutDashboard,
  profile: UserRound,
  faucet: Droplets,
  stake: Wallet,
  content: BookOpen,
  rewards: Coins,
  governance: Vote,
  system: Shield,
  admin: LockKeyhole,
  explorer: ExternalLink,
} as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandaloneRoute = pathname.startsWith("/faucet");
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("knowledge-sidebar-collapsed");
    return saved === "true";
  });
  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  useEffect(() => {
    localStorage.setItem("knowledge-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  if (isStandaloneRoute) {
    return <>{children}</>;
  }

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside
        className="fixed left-0 top-0 z-40 h-screen border-r border-slate-200 bg-white/95 backdrop-blur transition-[width] duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-900/95"
        style={{ width: sidebarWidth }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-4">
            <div
              className={clsx(
                "flex min-w-0 items-center gap-3 transition-all duration-300",
                collapsed && "justify-center"
              )}
            >
              {collapsed ? (
                <div className="group relative h-11 w-11 shrink-0">
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm transition-opacity duration-200 group-hover:opacity-0 dark:bg-white dark:text-slate-950">
                    <BookOpen className="h-5 w-5" />
                  </div>

                  <button
                    onClick={() => setCollapsed(false)}
                    className="absolute inset-0 flex items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm opacity-0 transition-all duration-200 hover:bg-slate-50 group-hover:opacity-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    title={APP_SHELL_COPY.expandSidebar}
                    type="button"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
                    <BookOpen className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 overflow-hidden transition-all duration-300">
                    <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                      {BRANDING.appName}
                    </div>
                    <div className="truncate text-base font-semibold text-slate-950 dark:text-slate-100">
                      {BRANDING.chainName}
                    </div>
                  </div>
                </>
              )}
            </div>

            {!collapsed ? (
              <button
                onClick={() => setCollapsed(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                title={APP_SHELL_COPY.collapseSidebar}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <nav className="space-y-1 px-3 py-4">
              {INTERNAL_NAV_ITEMS.map((item) => {
                const Icon = iconMap[item.key];
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-testid={item.testId}
                    className={clsx(
                      "group flex items-center rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-300",
                      active
                        ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                      collapsed ? "justify-center" : "gap-3"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span
                      className={clsx(
                        "overflow-hidden whitespace-nowrap transition-all duration-300",
                        collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="px-3 py-2">
              {EXTERNAL_NAV_ITEMS.map((item) => {
                const Icon = iconMap[item.key];

                return (
                  <a
                    key={item.key}
                    href={BRANDING.explorerUrl}
                    data-testid={item.testId}
                    target="_blank"
                    rel="noreferrer"
                    className={clsx(
                      "group flex items-center rounded-2xl px-3 py-3 text-sm font-medium text-slate-600 transition-all duration-300 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                      collapsed ? "justify-center" : "gap-3"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span
                      className={clsx(
                        "overflow-hidden whitespace-nowrap transition-all duration-300",
                        collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                      )}
                    >
                      {item.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          <div className="mt-auto border-t border-slate-200 px-3 py-4 dark:border-slate-800">
            <div
              className={clsx(
                "rounded-2xl bg-slate-100 px-3 py-3 text-xs text-slate-500 transition-all duration-300 dark:bg-slate-800 dark:text-slate-400",
                collapsed ? "text-center" : ""
              )}
            >
              <span
                className={clsx(
                  "overflow-hidden whitespace-nowrap transition-all duration-300",
                  collapsed ? "inline-block w-0 opacity-0" : "inline-block w-auto opacity-100"
                )}
              >
                {APP_SHELL_COPY.footerLabel}
              </span>
              {collapsed && <Shield className="mx-auto h-4 w-4" />}
            </div>
          </div>
        </div>
      </aside>

      <header
        className="fixed right-0 top-0 z-30 flex h-20 items-center border-b border-slate-200 bg-slate-50/90 px-6 backdrop-blur transition-[left] duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950/90"
        style={{ left: sidebarWidth }}
      >
        <div className="flex w-full items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {APP_SHELL_COPY.workspaceLabel}
            </div>
            <div className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-100">
              {pageTitle}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

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
                      className={clsx(
                        topbarButtonClass,
                        neutralButtonClass,
                        "pointer-events-none opacity-0"
                      )}
                      aria-hidden="true"
                      tabIndex={-1}
                      type="button"
                    >
                      <Wallet className="h-4 w-4" />
                      {APP_SHELL_COPY.connectWallet}
                    </button>
                  );
                }

                if (!connected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      className={clsx(topbarButtonClass, neutralButtonClass)}
                      type="button"
                    >
                      <Wallet className="h-4 w-4" />
                      {APP_SHELL_COPY.connectWallet}
                    </button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <button
                      onClick={openChainModal}
                      className={clsx(topbarButtonClass, dangerButtonClass)}
                      type="button"
                    >
                      <Shield className="h-4 w-4" />
                      {APP_SHELL_COPY.wrongNetwork}
                    </button>
                  );
                }

                return (
                  <button
                    onClick={openAccountModal}
                    className={clsx(topbarButtonClass, neutralButtonClass)}
                    type="button"
                  >
                    <Wallet className="h-4 w-4" />
                    {account.displayName}
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </header>

      <div
        className="transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft: sidebarWidth }}
      >
        <div className="pt-20">{children}</div>
      </div>
    </div>
  );
}
