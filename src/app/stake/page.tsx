"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Coins, ShieldCheck, Wallet } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { toast } from "sonner";
import {
	useAccount,
	useBalance,
	useBlockNumber,
	usePublicClient,
	useReadContract,
	useWriteContract,
} from "wagmi";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { BRANDING } from "@/lib/branding";
import { writeTxToast } from "@/lib/tx-toast";
import { asBigInt } from "@/lib/web3-types";

function tryParseAmount(value: string) {
	if (!value.trim()) return null;

	try {
		const amount = parseEther(value.trim());
		return amount > 0n ? amount : null;
	} catch {
		return null;
	}
}

function formatTokenInput(amount: bigint) {
	const formatted = formatEther(amount);
	return formatted.replace(/\.?0+$/, "") || "0";
}

function formatDuration(seconds: bigint) {
	if (seconds <= 0n) return "现在即可操作";

	const total = Number(seconds);
	const days = Math.floor(total / 86400);
	const hours = Math.floor((total % 86400) / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const remainSeconds = total % 60;

	if (days > 0) return `${days}天 ${hours}小时`;
	if (hours > 0) return `${hours}小时 ${minutes}分钟`;
	if (minutes > 0) return `${minutes}分钟 ${remainSeconds}秒`;
	return `${remainSeconds}秒`;
}

function formatTimestamp(timestamp: bigint) {
	return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
		hour12: false,
	});
}

function getScaledAmount(base: bigint, numerator: bigint, denominator: bigint) {
	if (base <= 0n) return 0n;
	if (numerator === denominator) return base;

	const scaled = (base * numerator) / denominator;
	return scaled > 0n ? scaled : 0n;
}

const stakeFlowSteps = [
	{
		id: 1,
		title: "Deposit",
		description: "先存入原生币，形成待激活质押。",
	},
	{
		id: 2,
		title: "Activate",
		description: "等待激活区块达到后启用投票权。",
	},
	{
		id: 3,
		title: "Request Withdraw",
		description: "申请退出后，质押会进入冷却阶段。",
	},
	{
		id: 4,
		title: "Withdraw",
		description: "冷却结束后提取原生币回到钱包。",
	},
] as const;

export default function StakePage() {
	const { address } = useAccount();
	const publicClient = usePublicClient();
	const { writeContractAsync } = useWriteContract();
	const refreshAfterTx = useRefreshOnTxConfirmed();
	const { data: blockNumber } = useBlockNumber({ watch: true });
	const { data: nativeBalance, refetch: refetchNativeBalance } = useBalance({
		address,
		query: { enabled: !!address },
	});

	const [depositAmount, setDepositAmount] = useState("1");
	const [withdrawAmount, setWithdrawAmount] = useState("1");
	const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
	const [liveBlockNumber, setLiveBlockNumber] = useState<bigint | undefined>(
		typeof blockNumber === "bigint" ? blockNumber : undefined
	);

	useEffect(() => {
		const timer = window.setInterval(() => {
			setNowTs(Math.floor(Date.now() / 1000));
		}, 1000);

		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		if (typeof blockNumber === "bigint") {
			setLiveBlockNumber(blockNumber);
		}
	}, [blockNumber]);

	useEffect(() => {
		if (!publicClient) return;

		let cancelled = false;

		const updateBlockNumber = async () => {
			try {
				const latestBlock = await publicClient.getBlockNumber();
				if (!cancelled) {
					setLiveBlockNumber(latestBlock);
				}
			} catch {
				// Ignore transient polling failures and keep the last known block number.
			}
		};

		void updateBlockNumber();
		const timer = window.setInterval(() => {
			void updateBlockNumber();
		}, 8000);

		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [publicClient]);

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

	const { data: activationBlocksData } = useReadContract({
		address: CONTRACTS.NativeVotes as `0x${string}`,
		abi: ABIS.NativeVotes,
		functionName: "activationBlocks",
	});

	const { data: cooldownSecondsData } = useReadContract({
		address: CONTRACTS.NativeVotes as `0x${string}`,
		abi: ABIS.NativeVotes,
		functionName: "cooldownSeconds",
	});

	const { data: activateAfterBlock, refetch: refetchActivateAfterBlock } = useReadContract({
		address: CONTRACTS.NativeVotes as `0x${string}`,
		abi: ABIS.NativeVotes,
		functionName: "activateAfterBlock",
		args: address ? [address] : undefined,
		query: { enabled: !!address },
	});

	const { data: withdrawAfterTime, refetch: refetchWithdrawAfterTime } = useReadContract({
		address: CONTRACTS.NativeVotes as `0x${string}`,
		abi: ABIS.NativeVotes,
		functionName: "withdrawAfterTime",
		args: address ? [address] : undefined,
		query: { enabled: !!address },
	});

	const votesValue = asBigInt(votes) ?? 0n;
	const stakedValue = asBigInt(staked) ?? 0n;
	const pendingStakeValue = asBigInt(pendingStake) ?? 0n;
	const pendingWithdrawValue = asBigInt(pendingWithdraw) ?? 0n;
	const activationBlocksValue = asBigInt(activationBlocksData) ?? 0n;
	const cooldownSecondsValue = asBigInt(cooldownSecondsData) ?? 0n;
	const activateAfterBlockValue = asBigInt(activateAfterBlock) ?? 0n;
	const withdrawAfterTimeValue = asBigInt(withdrawAfterTime) ?? 0n;
	const currentBlock = liveBlockNumber;
	const walletBalanceValue = nativeBalance?.value ?? 0n;
	const depositAmountWei = useMemo(() => tryParseAmount(depositAmount), [depositAmount]);
	const withdrawAmountWei = useMemo(() => tryParseAmount(withdrawAmount), [withdrawAmount]);
	const hasPendingStake = pendingStakeValue > 0n;
	const hasPendingWithdraw = pendingWithdrawValue > 0n;
	const activateRemainingBlocks =
		hasPendingStake &&
		currentBlock !== undefined &&
		activateAfterBlockValue > currentBlock
			? activateAfterBlockValue - currentBlock
			: 0n;
	const withdrawRemainingSeconds =
		hasPendingWithdraw && withdrawAfterTimeValue > BigInt(nowTs)
			? withdrawAfterTimeValue - BigInt(nowTs)
			: 0n;

	const depositDisabled =
		!address ||
		depositAmountWei === null ||
		depositAmountWei > walletBalanceValue;
	const activateDisabled =
		!address ||
		!hasPendingStake ||
		currentBlock === undefined ||
		activateRemainingBlocks > 0n;
	const requestWithdrawDisabled =
		!address ||
		withdrawAmountWei === null ||
		stakedValue <= 0n ||
		withdrawAmountWei > stakedValue;
	const withdrawDisabled =
		!address ||
		withdrawAmountWei === null ||
		!hasPendingWithdraw ||
		withdrawAmountWei > pendingWithdrawValue ||
		withdrawRemainingSeconds > 0n;

	const activateHelperText = !address
		? "连接钱包后可查看激活条件。"
		: !hasPendingStake
			? "暂无待激活质押，先存入后再激活。"
			: activateRemainingBlocks > 0n
				? `还需等待 ${activateRemainingBlocks.toString()} 个区块，预计在区块 #${activateAfterBlockValue.toString()} 后可激活。`
				: "当前待激活质押已满足条件，可以立即激活。";

	const withdrawHelperText = !address
		? "连接钱包后可查看提现冷却状态。"
		: !hasPendingWithdraw
			? "暂无待提取余额，申请退出后会进入冷却期。"
			: withdrawRemainingSeconds > 0n
				? `还需等待 ${formatDuration(withdrawRemainingSeconds)}，预计 ${formatTimestamp(withdrawAfterTimeValue)} 后可提取。`
				: "当前待提取余额已满足条件，可以立即提取。";
	const activeFlowStep = hasPendingWithdraw
		? withdrawRemainingSeconds > 0n
			? 3
			: 4
		: hasPendingStake
			? 2
			: stakedValue > 0n
				? 3
				: 1;
	const currentStakeStageText = !address
		? "当前未连接钱包"
		: hasPendingWithdraw
			? withdrawRemainingSeconds > 0n
				? `当前处于退出冷却阶段，还需等待 ${formatDuration(withdrawRemainingSeconds)}`
				: "当前已满足提现条件，可执行 Withdraw"
			: hasPendingStake
				? activateRemainingBlocks > 0n
					? `当前等待 Activate，还需 ${activateRemainingBlocks.toString()} 个区块`
					: "当前待激活质押已就绪，可执行 Activate"
				: stakedValue > 0n
					? "当前已持有生效投票权，可申请退出"
					: "当前尚未开始质押，可先执行 Deposit";

	const refreshStakeData = useCallback(async () => {
		await Promise.all([
			refetchVotes(),
			refetchStaked(),
			refetchPendingStake(),
			refetchPendingWithdraw(),
			refetchActivateAfterBlock(),
			refetchWithdrawAfterTime(),
			refetchNativeBalance(),
		]);
	}, [
		refetchActivateAfterBlock,
		refetchNativeBalance,
		refetchPendingStake,
		refetchPendingWithdraw,
		refetchStaked,
		refetchVotes,
		refetchWithdrawAfterTime,
	]);

	function applyQuickAmount(
		base: bigint,
		numerator: bigint,
		denominator: bigint,
		setter: (value: string) => void
	) {
		const amount = getScaledAmount(base, numerator, denominator);
		if (amount > 0n) {
			setter(formatTokenInput(amount));
		}
	}

	async function handleDeposit() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		const amount = parseAmount(depositAmount, "质押数量");
		if (amount === null) return;

		if (amount > walletBalanceValue) {
			toast.error("质押数量不能超过钱包可用余额");
			return;
		}

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

		if (!hasPendingStake) {
			toast.error("当前没有待激活的质押");
			return;
		}

		if (activateRemainingBlocks > 0n) {
			toast.error(`还需等待 ${activateRemainingBlocks.toString()} 个区块后才能激活`);
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

		const amount = parseAmount(withdrawAmount, "退出数量");
		if (amount === null) return;

		if (stakedValue <= 0n) {
			toast.error("当前没有可退出的已质押余额");
			return;
		}

		if (amount > stakedValue) {
			toast.error("退出数量不能超过已质押余额");
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

		if (!hasPendingWithdraw) {
			toast.error("当前没有可提取的待提取余额");
			return;
		}

		if (amount > pendingWithdrawValue) {
			toast.error("提取数量不能超过待提取余额");
			return;
		}

		if (withdrawRemainingSeconds > 0n) {
			toast.error(`还需等待 ${formatDuration(withdrawRemainingSeconds)} 后才能提取`);
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
		<main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
			<PageHeader
				eyebrow="Staking · Voting Power"
				title="Stake & Voting Power"
				description="先质押原生币并激活投票权，再参与内容投票和 DAO 治理；退出质押需要先申请，再等待冷却期结束。"
			/>

			<section className="rounded-3xl border border-amber-200/70 bg-linear-to-r from-amber-50 via-white to-sky-50 p-3.5 shadow-sm dark:border-amber-900/40 dark:from-amber-950/20 dark:via-slate-900 dark:to-sky-950/10">
				<div className="flex flex-col gap-2.5 md:flex-row md:items-start md:justify-between">
					<div>
						<div className="text-lg font-semibold text-slate-950 dark:text-slate-100">
							Stake 操作路径
						</div>
					</div>
					<div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-white/85 px-3 py-1 text-xs font-medium text-amber-800 shadow-sm dark:border-amber-800/60 dark:bg-slate-900/75 dark:text-amber-300">
						<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
							{activeFlowStep}
						</span>
						<span>当前步骤</span>
						<span className="hidden h-1 w-1 rounded-full bg-amber-400 md:block dark:bg-amber-500" />
						<span className="hidden md:block">{currentStakeStageText}</span>
					</div>
				</div>
				<div className="mt-2.5 grid gap-2 md:grid-cols-4">
					{stakeFlowSteps.map((step) => {
						const isActive = step.id === activeFlowStep;
						return (
							<div
								key={step.id}
								className={`rounded-2xl border px-3.5 py-3 transition ${
									isActive
										? "border-amber-300 bg-white shadow-sm dark:border-amber-700 dark:bg-slate-900"
										: "border-white/70 bg-white/60 dark:border-slate-800 dark:bg-slate-900/60"
								}`}
							>
								<div className="flex items-center gap-2">
									<div className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-slate-950 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
										{step.id}
									</div>
									<div className="min-w-0">
										<div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
											Step {step.id}
										</div>
										<div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
											{step.title}
										</div>
									</div>
								</div>
								<div className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
									{step.description}
								</div>
								{isActive ? (
									<div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
										当前阶段
									</div>
								) : null}
							</div>
						);
					})}
				</div>
			</section>

			<section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
				<div className="flex h-28 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-2.5 flex items-center justify-between">
						<div className="text-xs text-slate-500 dark:text-slate-400">投票权</div>
						<ShieldCheck className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-lg font-semibold leading-none text-slate-950 dark:text-slate-100">
						{formatEther(votesValue)} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-auto pt-1.5 text-xs text-slate-500 dark:text-slate-400">
						已激活并生效的治理投票权。
					</div>
				</div>

				<div className="flex h-28 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-2.5 flex items-center justify-between">
						<div className="text-xs text-slate-500 dark:text-slate-400">已激活质押</div>
						<Coins className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-lg font-semibold leading-none text-slate-950 dark:text-slate-100">
						{formatEther(stakedValue)} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-auto pt-1.5 text-xs text-slate-500 dark:text-slate-400">
						当前已生效的质押余额。
					</div>
				</div>

				<div className="flex h-28 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-2.5 flex items-center justify-between">
						<div className="text-xs text-slate-500 dark:text-slate-400">待激活质押</div>
						<Clock3 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-lg font-semibold leading-none text-slate-950 dark:text-slate-100">
						{formatEther(pendingStakeValue)} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-auto pt-1.5 text-xs text-slate-500 dark:text-slate-400">
						{hasPendingStake
							? activateRemainingBlocks > 0n
								? `还需 ${activateRemainingBlocks.toString()} 个区块`
								: "现在可以激活"
							: `默认等待 ${activationBlocksValue.toString()} 个区块`}
					</div>
				</div>

				<div className="flex h-28 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-2.5 flex items-center justify-between">
						<div className="text-xs text-slate-500 dark:text-slate-400">待提取金额</div>
						<Wallet className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-lg font-semibold leading-none text-slate-950 dark:text-slate-100">
						{formatEther(pendingWithdrawValue)} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-auto pt-1.5 text-xs text-slate-500 dark:text-slate-400">
						{hasPendingWithdraw
							? withdrawRemainingSeconds > 0n
								? `还需 ${formatDuration(withdrawRemainingSeconds)}`
								: "现在可以提取"
							: `默认冷却 ${formatDuration(cooldownSecondsValue)}`}
					</div>
				</div>
			</section>

			<div className="grid gap-4 lg:grid-cols-2">
				<SectionCard
					title="质押与激活"
					description="先发起 Deposit 锁定原生币；等激活区块数达到后，再执行 Activate 获得投票权。"
					className="p-5"
				>
					<div className="space-y-3">
						<input
							className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
							value={depositAmount}
							onChange={(event) => setDepositAmount(event.target.value)}
							placeholder="输入质押数量，例如 1"
						/>

						<div className="grid gap-2.5 md:grid-cols-2">
							<div className="space-y-2">
								<div className="text-xs font-medium text-slate-500 dark:text-slate-400">
									按钱包余额填充
								</div>
								<div className="flex flex-wrap gap-2">
									<QuickAmountButton
										label="25%"
										onClick={() => applyQuickAmount(walletBalanceValue, 1n, 4n, setDepositAmount)}
										disabled={!address || walletBalanceValue <= 0n}
									/>
									<QuickAmountButton
										label="50%"
										onClick={() => applyQuickAmount(walletBalanceValue, 1n, 2n, setDepositAmount)}
										disabled={!address || walletBalanceValue <= 0n}
									/>
									<QuickAmountButton
										label="MAX"
										onClick={() => applyQuickAmount(walletBalanceValue, 1n, 1n, setDepositAmount)}
										disabled={!address || walletBalanceValue <= 0n}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<div className="text-xs font-medium text-slate-500 dark:text-slate-400">
									按待激活质押填充
								</div>
								<div className="flex flex-wrap gap-2">
									<QuickAmountButton
										label="25%"
										onClick={() => applyQuickAmount(pendingStakeValue, 1n, 4n, setDepositAmount)}
										disabled={pendingStakeValue <= 0n}
									/>
									<QuickAmountButton
										label="50%"
										onClick={() => applyQuickAmount(pendingStakeValue, 1n, 2n, setDepositAmount)}
										disabled={pendingStakeValue <= 0n}
									/>
									<QuickAmountButton
										label="全部待激活"
										onClick={() => applyQuickAmount(pendingStakeValue, 1n, 1n, setDepositAmount)}
										disabled={pendingStakeValue <= 0n}
									/>
								</div>
							</div>
						</div>

						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
							<div>钱包可用余额：{formatEther(walletBalanceValue)} {BRANDING.nativeTokenSymbol}</div>
							<div>默认激活等待：{activationBlocksValue.toString()} 个区块</div>
							<div>{activateHelperText}</div>
						</div>

						<div className="flex flex-wrap gap-3">
							<button
								data-testid="stake-deposit-button"
								onClick={handleDeposit}
								disabled={depositDisabled}
								className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
							>
								存入
							</button>
							<button
								data-testid="stake-activate-button"
								onClick={handleActivate}
								disabled={activateDisabled}
								className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								激活
							</button>
						</div>
					</div>
				</SectionCard>

				<SectionCard
					title="退出与提现"
					description="先申请退出，系统会立即减少投票权；等冷却期结束后，再执行 Withdraw 提取原生币。"
					className="p-5"
				>
					<div className="space-y-3">
						<input
							className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
							value={withdrawAmount}
							onChange={(event) => setWithdrawAmount(event.target.value)}
							placeholder="输入退出或提取数量，例如 1"
						/>

						<div className="grid gap-2.5 md:grid-cols-2">
							<div className="space-y-2">
								<div className="text-xs font-medium text-slate-500 dark:text-slate-400">
									按已质押余额填充
								</div>
								<div className="flex flex-wrap gap-2">
									<QuickAmountButton
										label="25%"
										onClick={() => applyQuickAmount(stakedValue, 1n, 4n, setWithdrawAmount)}
										disabled={stakedValue <= 0n}
									/>
									<QuickAmountButton
										label="50%"
										onClick={() => applyQuickAmount(stakedValue, 1n, 2n, setWithdrawAmount)}
										disabled={stakedValue <= 0n}
									/>
									<QuickAmountButton
										label="全部已质押"
										onClick={() => applyQuickAmount(stakedValue, 1n, 1n, setWithdrawAmount)}
										disabled={stakedValue <= 0n}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<div className="text-xs font-medium text-slate-500 dark:text-slate-400">
									按待提取余额填充
								</div>
								<div className="flex flex-wrap gap-2">
									<QuickAmountButton
										label="25%"
										onClick={() => applyQuickAmount(pendingWithdrawValue, 1n, 4n, setWithdrawAmount)}
										disabled={pendingWithdrawValue <= 0n}
									/>
									<QuickAmountButton
										label="50%"
										onClick={() => applyQuickAmount(pendingWithdrawValue, 1n, 2n, setWithdrawAmount)}
										disabled={pendingWithdrawValue <= 0n}
									/>
									<QuickAmountButton
										label="全部待提取"
										onClick={() => applyQuickAmount(pendingWithdrawValue, 1n, 1n, setWithdrawAmount)}
										disabled={pendingWithdrawValue <= 0n}
									/>
								</div>
							</div>
						</div>

						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
							<div>退出冷却期：{formatDuration(cooldownSecondsValue)}</div>
							<div>{withdrawHelperText}</div>
						</div>

						<div className="flex flex-wrap gap-3">
							<button
								data-testid="stake-request-withdraw-button"
								onClick={handleRequestWithdraw}
								disabled={requestWithdrawDisabled}
								className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								申请退出
							</button>
							<button
								data-testid="stake-withdraw-button"
								onClick={handleWithdraw}
								disabled={withdrawDisabled}
								className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
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

function QuickAmountButton({
	label,
	onClick,
	disabled,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
		>
			{label}
		</button>
	);
}

