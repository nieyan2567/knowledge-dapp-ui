"use client";

import { useCallback, useState } from "react";
import { Clock3, Coins, ShieldCheck, Wallet } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { toast } from "sonner";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { writeTxToast } from "@/lib/tx-toast";
import { asBigInt } from "@/lib/web3-types";

export default function StakePage() {
	const { address } = useAccount();
	const publicClient = usePublicClient();
	const { writeContractAsync } = useWriteContract();
	const refreshAfterTx = useRefreshOnTxConfirmed();

	const [depositAmount, setDepositAmount] = useState("1");
	const [withdrawAmount, setWithdrawAmount] = useState("1");

	function parseAmount(value: string, field: string) {
		if (!value.trim()) {
			toast.error(`请输入${field}`);
			return null;
		}

		try {
			const amount = parseEther(value.trim());
			if (amount <= 0n) {
				toast.error(`${field}必须大于 0`);
				return null;
			}
			return amount;
		} catch {
			toast.error(`请输入有效的${field}`);
			return null;
		}
	}

	const { data: votes, refetch: refetchVotes } = useReadContract({
		address: CONTRACTS.NativeVotes as `0x${string}`,
		abi: ABIS.NativeVotes,
		functionName: "getVotes",
		args: address ? [address] : undefined,
		query: { enabled: !!address },
	});

	const { data: staked, refetch: refetchStaked } = useReadContract({
		address: CONTRACTS.NativeVotes as `0x${string}`,
		abi: ABIS.NativeVotes,
		functionName: "staked",
		args: address ? [address] : undefined,
		query: { enabled: !!address },
	});

	const { data: pendingStake, refetch: refetchPendingStake } = useReadContract({
		address: CONTRACTS.NativeVotes as `0x${string}`,
		abi: ABIS.NativeVotes,
		functionName: "pendingStake",
		args: address ? [address] : undefined,
		query: { enabled: !!address },
	});

	const { data: pendingWithdraw, refetch: refetchPendingWithdraw } = useReadContract({
		address: CONTRACTS.NativeVotes as `0x${string}`,
		abi: ABIS.NativeVotes,
		functionName: "pendingWithdraw",
		args: address ? [address] : undefined,
		query: { enabled: !!address },
	});

	const votesValue = asBigInt(votes);
	const stakedValue = asBigInt(staked);
	const pendingStakeValue = asBigInt(pendingStake);
	const pendingWithdrawValue = asBigInt(pendingWithdraw);

	const refreshStakeData = useCallback(async () => {
		await Promise.all([
			refetchVotes(),
			refetchStaked(),
			refetchPendingStake(),
			refetchPendingWithdraw(),
		]);
	}, [refetchPendingStake, refetchPendingWithdraw, refetchStaked, refetchVotes]);

	async function handleDeposit() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		const amount = parseAmount(depositAmount, "质押数量");
		if (amount === null) return;

		const hash = await writeTxToast({
			publicClient,
			writeContractAsync,
			request: {
				address: CONTRACTS.NativeVotes as `0x${string}`,
				abi: ABIS.NativeVotes,
				functionName: "deposit",
				value: amount,
				account: address,
			},
			loading: "正在提交质押交易...",
			success: "质押交易已提交",
			fail: "质押失败",
		});

		if (!hash) return;

		await refreshAfterTx(hash, refreshStakeData, ["stake", "dashboard"]);
	}

	async function handleActivate() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		if (!pendingStakeValue || pendingStakeValue <= 0n) {
			toast.error("当前没有待激活的质押");
			return;
		}

		const hash = await writeTxToast({
			publicClient,
			writeContractAsync,
			request: {
				address: CONTRACTS.NativeVotes as `0x${string}`,
				abi: ABIS.NativeVotes,
				functionName: "activate",
				account: address,
			},
			loading: "正在提交激活交易...",
			success: "激活交易已提交",
			fail: "激活失败",
		});

		if (!hash) return;

		await refreshAfterTx(hash, refreshStakeData, ["stake", "dashboard"]);
	}

	async function handleRequestWithdraw() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		const amount = parseAmount(withdrawAmount, "提取数量");
		if (amount === null) return;

		if (!stakedValue || stakedValue <= 0n) {
			toast.error("当前没有可退出的已质押余额");
			return;
		}

		if (amount > stakedValue) {
			toast.error("提取数量不能超过已质押余额");
			return;
		}

		const hash = await writeTxToast({
			publicClient,
			writeContractAsync,
			request: {
				address: CONTRACTS.NativeVotes as `0x${string}`,
				abi: ABIS.NativeVotes,
				functionName: "requestWithdraw",
				args: [amount],
				account: address,
			},
			loading: "正在提交退出申请...",
			success: "退出申请已提交",
			fail: "退出申请失败",
		});

		if (!hash) return;

		await refreshAfterTx(hash, refreshStakeData, ["stake", "dashboard"]);
	}

	async function handleWithdraw() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		const amount = parseAmount(withdrawAmount, "提取数量");
		if (amount === null) return;

		if (!pendingWithdrawValue || pendingWithdrawValue <= 0n) {
			toast.error("当前没有可提取的待提取余额");
			return;
		}

		if (amount > pendingWithdrawValue) {
			toast.error("提取数量不能超过待提取余额");
			return;
		}

		const hash = await writeTxToast({
			publicClient,
			writeContractAsync,
			request: {
				address: CONTRACTS.NativeVotes as `0x${string}`,
				abi: ABIS.NativeVotes,
				functionName: "withdraw",
				args: [amount],
				account: address,
			},
			loading: "正在提交提取交易...",
			success: "提取交易已提交",
			fail: "提取失败",
		});

		if (!hash) return;

		await refreshAfterTx(hash, refreshStakeData, ["stake", "dashboard"]);
	}

	return (
		<main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
			<PageHeader
				eyebrow="Staking · Voting Power"
				title="Stake & Voting Power"
				description="用户需要先质押原生币并激活投票权，才能参与内容投票和 DAO 治理。退出质押时需要先发起申请，再等待冷却期结束。"
			/>

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							投票权
						</div>
						<ShieldCheck className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{votesValue ? formatEther(votesValue) : "0"} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						已激活的有效投票权
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							已激活质押
						</div>
						<Coins className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{stakedValue ? formatEther(stakedValue) : "0"} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						当前已生效的质押余额
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							待激活质押
						</div>
						<Clock3 className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{pendingStakeValue ? formatEther(pendingStakeValue) : "0"} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						等待区块确认后可激活
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-4 flex items-center justify-between">
						<div className="text-sm text-slate-500 dark:text-slate-400">
							待提取金额
						</div>
						<Wallet className="h-5 w-5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
						{pendingWithdrawValue ? formatEther(pendingWithdrawValue) : "0"} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
						冷却期结束后可执行提现
					</div>
				</div>
			</section>

			<div className="grid gap-6 lg:grid-cols-2">
				<SectionCard
					title="质押与激活"
					description="先发起 Deposit，把原生币锁进合约；等到激活区块数达到后，再点击 Activate 获得投票权。"
				>
					<div className="space-y-4">
						<input
							className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
							value={depositAmount}
							onChange={(event) => setDepositAmount(event.target.value)}
							placeholder="输入质押数量，例如 1"
						/>
						<div className="flex flex-wrap gap-3">
							<button
								data-testid="stake-deposit-button"
								onClick={handleDeposit}
								className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
							>
								存入
							</button>
							<button
								onClick={handleActivate}
								className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								激活
							</button>
						</div>
					</div>
				</SectionCard>

				<SectionCard
					title="退出与提现"
					description="先申请退出，系统会立即减少你的投票权；等冷却期结束后，再执行 Withdraw 提取原生币。"
				>
					<div className="space-y-4">
						<input
							className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
							value={withdrawAmount}
							onChange={(event) => setWithdrawAmount(event.target.value)}
							placeholder="输入提取数量，例如 1"
						/>
						<div className="flex flex-wrap gap-3">
							<button
								onClick={handleRequestWithdraw}
								className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								申请退出
							</button>
							<button
								onClick={handleWithdraw}
								className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
							>
								提取
							</button>
						</div>
					</div>
				</SectionCard>
			</div>
		</main>
	);
}
