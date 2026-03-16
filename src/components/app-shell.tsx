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
    LayoutDashboard,
    Shield,
    Vote,
    Wallet,
} from "lucide-react";
import clsx from "clsx";
import { ThemeToggle } from "@/components/theme-toggle";

const EXPANDED_WIDTH = 272;
const COLLAPSED_WIDTH = 88;

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/stake", label: "Stake", icon: Wallet },
    { href: "/content", label: "Content", icon: BookOpen },
    { href: "/rewards", label: "Rewards", icon: Coins },
    { href: "/governance", label: "Governance", icon: Vote },
    { href: "/system", label: "System", icon: Shield },
];

function getPageTitle(pathname: string) {
    const item = navItems.find((i) => i.href === pathname);
    return item?.label || "Knowledge DApp";
}

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

    useEffect(() => {
        const saved = localStorage.getItem("knowledge-sidebar-collapsed");
        if (saved === "true") setCollapsed(true);
    }, []);

    useEffect(() => {
        localStorage.setItem("knowledge-sidebar-collapsed", String(collapsed));
    }, [collapsed]);

    const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            {/* Sidebar */}
            <aside
                className="fixed left-0 top-0 z-40 h-screen border-r border-slate-200 bg-white/95 backdrop-blur transition-[width] duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-900/95"
                style={{ width: sidebarWidth }}
            >
                <div className="flex h-full flex-col">
                    {/* Brand */}
                    <div className="flex items-center justify-between px-4 py-4">
                        <div
                            className={clsx(
                                "flex min-w-0 items-center gap-3 transition-all duration-300",
                                collapsed && "justify-center"
                            )}
                        >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
                                <BookOpen className="h-5 w-5" />
                            </div>

                            <div
                                className={clsx(
                                    "min-w-0 overflow-hidden transition-all duration-300",
                                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                                )}
                            >
                                <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                                    Knowledge DApp
                                </div>
                                <div className="truncate text-base font-semibold text-slate-950 dark:text-slate-100">
                                    KnowChain
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setCollapsed((v) => !v)}
                            className={clsx(
                                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                                collapsed && "absolute right-4 top-4"
                            )}
                            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
                        >
                            {collapsed ? (
                                <ChevronRight className="h-4 w-4" />
                            ) : (
                                <ChevronLeft className="h-4 w-4" />
                            )}
                        </button>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 space-y-1 px-3 py-4">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = pathname === item.href;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
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

                    {/* Footer */}
                    <div className="border-t border-slate-200 px-3 py-4 dark:border-slate-800">
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
                                Local DAO Workspace
                            </span>
                            {collapsed && <Shield className="mx-auto h-4 w-4" />}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Topbar */}
            <header
                className="fixed right-0 top-0 z-30 flex h-20 items-center border-b border-slate-200 bg-slate-50/90 px-6 backdrop-blur transition-[left] duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950/90"
                style={{ left: sidebarWidth }}
            >
                <div className="flex w-full items-center justify-between">
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Workspace
                        </div>
                        <div className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-100">
                            {pageTitle}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <ConnectButton />
                    </div>
                </div>
            </header>

            {/* Content */}
            <div
                className="transition-[margin-left] duration-300 ease-in-out"
                style={{ marginLeft: sidebarWidth }}
            >
                <div className="pt-20">{children}</div>
            </div>
        </div>
    );
}
