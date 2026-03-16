"use client";

import { useState } from "react";
import { Clock3, Coins, ShieldCheck, Wallet } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { toast } from "sonner";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import { txToast } from "@/lib/tx-toast";

export default function StakePage() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();

    const [depositAmount, setDepositAmount] = useState("1");
    const [withdrawAmount, setWithdrawAmount] = useState("1");

    function parseAmount(value: string, field: string) {
        if (!value.trim()) {
            toast.error(`请输入${field}`);
            return null;
        }

        try {
            return parseEther(value.trim());
        } catch {
            toast.error(`请输入有效的${field}`);
            return null;
        }
    }

    const { data: votes } = useReadContract({
        address: CONTRACTS.NativeVotes as `0x${string}`,
        abi: ABIS.NativeVotes,
        functionName: "getVotes",
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    const { data: staked } = useReadContract({
        address: CONTRACTS.NativeVotes as `0x${string}`,
        abi: ABIS.NativeVotes,
        functionName: "staked",
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    const { data: pendingStake } = useReadContract({
        address: CONTRACTS.NativeVotes as `0x${string}`,
        abi: ABIS.NativeVotes,
        functionName: "pendingStake",
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    const { data: pendingWithdraw } = useReadContract({
        address: CONTRACTS.NativeVotes as `0x${string}`,
        abi: ABIS.NativeVotes,
        functionName: "pendingWithdraw",
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    async function handleDeposit() {
        if (!address) {
            toast.error("请先连接钱包");
            return;
        }

        const amount = parseAmount(depositAmount, "质押数量");
        if (amount === null) return;

        await txToast(
            writeContractAsync({
                address: CONTRACTS.NativeVotes as `0x${string}`,
                abi: ABIS.NativeVotes,
                functionName: "deposit",
                value: amount,
                account: address,
            }),
            "正在提交质押交易...",
            "质押交易已提交",
            "质押失败"
        );
    }

    async function handleActivate() {
        if (!address) {
            toast.error("请先连接钱包");
            return;
        }

        await txToast(
            writeContractAsync({
                address: CONTRACTS.NativeVotes as `0x${string}`,
                abi: ABIS.NativeVotes,
                functionName: "activate",
                account: address,
            }),
            "正在提交激活交易...",
            "激活交易已提交",
            "激活失败"
        );
    }

    async function handleRequestWithdraw() {
        if (!address) {
            toast.error("请先连接钱包");
            return;
        }

        const amount = parseAmount(withdrawAmount, "提取数量");
        if (amount === null) return;

        await txToast(
            writeContractAsync({
                address: CONTRACTS.NativeVotes as `0x${string}`,
                abi: ABIS.NativeVotes,
                functionName: "requestWithdraw",
                args: [amount],
                account: address,
            }),
            "正在提交退出申请...",
            "退出申请已提交",
            "退出申请失败"
        );
    }

    async function handleWithdraw() {
        if (!address) {
            toast.error("请先连接钱包");
            return;
        }

        const amount = parseAmount(withdrawAmount, "提取数量");
        if (amount === null) return;

        await txToast(
            writeContractAsync({
                address: CONTRACTS.NativeVotes as `0x${string}`,
                abi: ABIS.NativeVotes,
                functionName: "withdraw",
                args: [amount],
                account: address,
            }),
            "正在提交提取交易...",
            "提取交易已提交",
            "提取失败"
        );
    }

    return (
        <div>
            <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
                <PageHeader
                    eyebrow="Staking · Voting Power"
                    title="Stake & Voting Power"
                    description="用户先质押原生币，再激活投票权，才能参与内容投票和 DAO 治理。退出质押时需要先申请，再等待冷却期结束。"
                />

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Voting Power
                            </div>
                            <ShieldCheck className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
                            {votes ? formatEther(votes as bigint) : "0"}{" "}
                            {BRANDING.nativeTokenSymbol}
                        </div>
                        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            Activated voting power.
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Active Stake
                            </div>
                            <Coins className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
                            {staked ? formatEther(staked as bigint) : "0"}{" "}
                            {BRANDING.nativeTokenSymbol}
                        </div>
                        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            Stake already active on-chain.
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Pending Stake
                            </div>
                            <Clock3 className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
                            {pendingStake ? formatEther(pendingStake as bigint) : "0"}{" "}
                            {BRANDING.nativeTokenSymbol}
                        </div>
                        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            Waiting to be activated.
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Pending Withdraw
                            </div>
                            <Wallet className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
                            {pendingWithdraw ? formatEther(pendingWithdraw as bigint) : "0"}{" "}
                            {BRANDING.nativeTokenSymbol}
                        </div>
                        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            Amount available after cooldown.
                        </div>
                    </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-2">
                    <SectionCard
                        title="Deposit / Activate"
                        description="Deposit native tokens first, then activate them to gain voting power."
                    >
                        <div className="space-y-4">
                            <input
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                                value={depositAmount}
                                onChange={(event) => setDepositAmount(event.target.value)}
                                placeholder="Enter deposit amount, e.g. 1"
                            />
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={handleDeposit}
                                    className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                                >
                                    Deposit
                                </button>
                                <button
                                    onClick={handleActivate}
                                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Activate
                                </button>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Request Withdraw / Withdraw"
                        description="Request a withdraw first. After cooldown, complete the actual withdraw transaction."
                    >
                        <div className="space-y-4">
                            <input
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                                value={withdrawAmount}
                                onChange={(event) => setWithdrawAmount(event.target.value)}
                                placeholder="Enter withdraw amount, e.g. 1"
                            />
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={handleRequestWithdraw}
                                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Request Withdraw
                                </button>
                                <button
                                    onClick={handleWithdraw}
                                    className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                                >
                                    Withdraw
                                </button>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </main>
        </div>
    );
}