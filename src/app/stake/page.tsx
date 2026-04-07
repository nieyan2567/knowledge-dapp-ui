"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Coins, ShieldCheck, Wallet } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { toast } from "sonner";
import {
	useAccount,
	useBalance,
	usePublicClient,
	useWriteContract,
} from "wagmi";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useLiveChainClock } from "@/hooks/useLiveChainClock";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { BRANDING } from "@/lib/branding";
import { fetchIndexedStakeSummary, fetchIndexedSystemSnapshot } from "@/lib/indexer-api";
import { readStakeSummaryFromChain, type StakeSummaryData } from "@/lib/stake-summary";
import { readStakeConfigFromChain } from "@/lib/system-chain";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import {
	formatStakeDuration,
	formatStakeTokenInput,
	getScaledStakeAmount,
	STAKE_COPY,
	STAKE_FLOW_STEPS,
	tryParseStakeAmount,
} from "@/lib/stake-display";
import {
	getActivateHelperText,
	getActiveStakeFlowStep,
	getCurrentStakeStageText,
	getWithdrawHelperText,
} from "@/lib/stake-page-helpers";
import { writeTxToast } from "@/lib/tx-toast";

export default function StakePage() {
	const { address } = useAccount();
	const publicClient = usePublicClient();
	const { writeContractAsync } = useWriteContract();
	const refreshAfterTx = useRefreshOnTxConfirmed();
	const { nowTs, liveBlockNumber } = useLiveChainClock();
	const { data: nativeBalance, refetch: refetchNativeBalance } = useBalance({
		address,
		query: { enabled: !!address },
	});

	const [depositAmount, setDepositAmount] = useState("1");
	const [withdrawAmount, setWithdrawAmount] = useState("1");
	const [stakeSummary, setStakeSummary] = useState<StakeSummaryData>({
		vote_amount: 0n,
		staked_amount: 0n,
		pending_stake_amount: 0n,
		pending_withdraw_amount: 0n,
		activate_after_block: 0n,
		withdraw_after_time: 0n,
	});
	const [systemConfig, setSystemConfig] = useState({
		activationBlocks: 0n,
		cooldownSeconds: 0n,
	});

	const loadStakeSummary = useCallback(async () => {
		if (!publicClient || !address) {
			setStakeSummary({
				vote_amount: 0n,
				staked_amount: 0n,
				pending_stake_amount: 0n,
				pending_withdraw_amount: 0n,
				activate_after_block: 0n,
				withdraw_after_time: 0n,
			});
			return;
		}

		const indexedSummary = await fetchIndexedStakeSummary(address);

		if (indexedSummary) {
			setStakeSummary({
				vote_amount: BigInt(indexedSummary.vote_amount),
				staked_amount: BigInt(indexedSummary.staked_amount),
				pending_stake_amount: BigInt(indexedSummary.pending_stake_amount),
				pending_withdraw_amount: BigInt(indexedSummary.pending_withdraw_amount),
				activate_after_block: BigInt(indexedSummary.activate_after_block),
				withdraw_after_time: BigInt(indexedSummary.withdraw_after_time),
			});
			return;
		}

		setStakeSummary(await readStakeSummaryFromChain(publicClient, address));
	}, [address, publicClient]);

	const loadStakeConfig = useCallback(async () => {
		const indexedSnapshot = await fetchIndexedSystemSnapshot();

		if (indexedSnapshot) {
			setSystemConfig({
				activationBlocks: BigInt(indexedSnapshot.activation_blocks),
				cooldownSeconds: BigInt(indexedSnapshot.cooldown_seconds),
			});
			return;
		}

		if (!publicClient) {
			setSystemConfig({
				activationBlocks: 0n,
				cooldownSeconds: 0n,
			});
			return;
		}

		setSystemConfig(await readStakeConfigFromChain(publicClient));
	}, [publicClient]);

	function parseAmount(value: string, field: string) {
		if (!value.trim()) {
			toast.error(`${STAKE_COPY.amountRequiredPrefix}${field}`);
			return null;
		}

		try {
			const amount = parseEther(value.trim());
			if (amount <= 0n) {
				toast.error(`${field}${STAKE_COPY.amountMustBePositiveSuffix}`);
				return null;
			}
			return amount;
		} catch {
			toast.error(`${STAKE_COPY.invalidAmountPrefix}${field}`);
			return null;
		}
	}

	const votesValue = stakeSummary.vote_amount;
	const stakedValue = stakeSummary.staked_amount;
	const pendingStakeValue = stakeSummary.pending_stake_amount;
	const pendingWithdrawValue = stakeSummary.pending_withdraw_amount;
	const activationBlocksValue = systemConfig.activationBlocks;
	const cooldownSecondsValue = systemConfig.cooldownSeconds;
	const activateAfterBlockValue = stakeSummary.activate_after_block;
	const withdrawAfterTimeValue = stakeSummary.withdraw_after_time;
	const currentBlock = liveBlockNumber;
	const walletBalanceValue = nativeBalance?.value ?? 0n;
	const depositAmountWei = useMemo(() => tryParseStakeAmount(depositAmount), [depositAmount]);
	const withdrawAmountWei = useMemo(() => tryParseStakeAmount(withdrawAmount), [withdrawAmount]);
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
		hasPendingWithdraw ||
		stakedValue <= 0n ||
		withdrawAmountWei > stakedValue;
	const cancelPendingDisabled =
		!address ||
		depositAmountWei === null ||
		!hasPendingStake ||
		depositAmountWei > pendingStakeValue;
	const withdrawDisabled =
		!address ||
		withdrawAmountWei === null ||
		!hasPendingWithdraw ||
		withdrawAmountWei > pendingWithdrawValue ||
		withdrawRemainingSeconds > 0n;

	const activateHelperText = getActivateHelperText({
		address,
		hasPendingStake,
		activateRemainingBlocks,
		activateAfterBlockValue,
	});

	const withdrawHelperText = getWithdrawHelperText({
		address,
		hasPendingWithdraw,
		withdrawRemainingSeconds,
		withdrawAfterTimeValue,
	});
	const activeFlowStep = getActiveStakeFlowStep({
		hasPendingWithdraw,
		withdrawRemainingSeconds,
		hasPendingStake,
		stakedValue,
	});
	const currentStakeStageText = getCurrentStakeStageText({
		address,
		hasPendingWithdraw,
		withdrawRemainingSeconds,
		hasPendingStake,
		activateRemainingBlocks,
		stakedValue,
	});

	const refreshStakeData = useCallback(async () => {
		await Promise.all([
			loadStakeSummary(),
			loadStakeConfig(),
			refetchNativeBalance(),
		]);
	}, [loadStakeConfig, loadStakeSummary, refetchNativeBalance]);

	useEffect(() => {
		void Promise.all([loadStakeSummary(), loadStakeConfig()]);
	}, [loadStakeConfig, loadStakeSummary]);

	function applyQuickAmount(
		base: bigint,
		numerator: bigint,
		denominator: bigint,
		setter: (value: string) => void
	) {
		const amount = getScaledStakeAmount(base, numerator, denominator);
		if (amount > 0n) {
			setter(formatStakeTokenInput(formatEther(amount)));
		}
	}

	async function handleDeposit() {
		if (!address) {
			toast.error(STAKE_COPY.connectWalletFirst);
			return;
		}

		const amount = parseAmount(depositAmount, STAKE_COPY.depositFieldLabel);
		if (amount === null) return;

		if (amount > walletBalanceValue) {
			toast.error(STAKE_COPY.walletBalanceExceeded);
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
			loading: STAKE_COPY.depositLoading,
			success: STAKE_COPY.depositSuccess,
			fail: STAKE_COPY.depositFail,
		});

		if (!hash) return;
		await refreshAfterTx(hash, refreshStakeData, ["stake", "dashboard"]);
	}

	async function handleActivate() {
		if (!address) {
			toast.error(STAKE_COPY.connectWalletFirst);
			return;
		}

		if (!hasPendingStake) {
			toast.error(STAKE_COPY.noPendingStake);
			return;
		}

		if (activateRemainingBlocks > 0n) {
			toast.error(
				`${STAKE_COPY.activateWaitPrefix} ${activateRemainingBlocks.toString()} ${STAKE_COPY.activateWaitSuffix}`
			);
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
			loading: STAKE_COPY.activateLoading,
			success: STAKE_COPY.activateSuccess,
			fail: STAKE_COPY.activateFail,
		});

		if (!hash) return;
		await refreshAfterTx(hash, refreshStakeData, ["stake", "dashboard"]);
	}

	async function handleCancelPendingStake() {
		if (!address) {
			toast.error(STAKE_COPY.connectWalletFirst);
			return;
		}

		const amount = parseAmount(depositAmount, STAKE_COPY.cancelPendingFieldLabel);
		if (amount === null) return;

		if (!hasPendingStake) {
			toast.error(STAKE_COPY.noPendingStakeToCancel);
			return;
		}

		if (amount > pendingStakeValue) {
			toast.error(STAKE_COPY.cancelPendingExceeded);
			return;
		}

		const hash = await writeTxToast({
			publicClient,
			writeContractAsync,
			request: {
				address: CONTRACTS.NativeVotes as `0x${string}`,
				abi: ABIS.NativeVotes,
				functionName: "cancelPendingStake",
				args: [amount],
				account: address,
			},
			loading: STAKE_COPY.cancelPendingLoading,
			success: STAKE_COPY.cancelPendingSuccess,
			fail: STAKE_COPY.cancelPendingFail,
		});

		if (!hash) return;
		await refreshAfterTx(hash, refreshStakeData, ["stake", "dashboard"]);
	}

	async function handleRequestWithdraw() {
		if (!address) {
			toast.error(STAKE_COPY.connectWalletFirst);
			return;
		}

		if (hasPendingWithdraw) {
			toast.error(STAKE_COPY.pendingWithdrawExists);
			return;
		}

		const amount = parseAmount(withdrawAmount, STAKE_COPY.requestWithdrawFieldLabel);
		if (amount === null) return;

		if (stakedValue <= 0n) {
			toast.error(STAKE_COPY.noStakedBalance);
			return;
		}

		if (amount > stakedValue) {
			toast.error(STAKE_COPY.withdrawRequestExceeded);
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
			loading: STAKE_COPY.requestWithdrawLoading,
			success: STAKE_COPY.requestWithdrawSuccess,
			fail: STAKE_COPY.requestWithdrawFail,
		});

		if (!hash) return;
		await refreshAfterTx(hash, refreshStakeData, ["stake", "dashboard"]);
	}

	async function handleWithdraw() {
		if (!address) {
			toast.error(STAKE_COPY.connectWalletFirst);
			return;
		}

		const amount = parseAmount(withdrawAmount, STAKE_COPY.withdrawFieldLabel);
		if (amount === null) return;

		if (!hasPendingWithdraw) {
			toast.error(STAKE_COPY.noPendingWithdraw);
			return;
		}

		if (amount > pendingWithdrawValue) {
			toast.error(STAKE_COPY.withdrawExceeded);
			return;
		}

		if (withdrawRemainingSeconds > 0n) {
			toast.error(
				`${STAKE_COPY.withdrawWaitPrefix} ${formatStakeDuration(withdrawRemainingSeconds)} ${STAKE_COPY.withdrawWaitSuffix}`
			);
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
			loading: STAKE_COPY.withdrawLoading,
			success: STAKE_COPY.withdrawSuccess,
			fail: STAKE_COPY.withdrawFail,
		});

		if (!hash) return;
		await refreshAfterTx(hash, refreshStakeData, ["stake", "dashboard"]);
	}

	return (
		<main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
			<PageHeader
				eyebrow="Staking · Voting Power"
				title={STAKE_COPY.headerTitle}
				description={STAKE_COPY.headerDescription}
				testId={PAGE_TEST_IDS.stake}
			/>

			<section className="rounded-3xl border border-amber-200/70 bg-linear-to-r from-amber-50 via-white to-sky-50 p-3.5 shadow-sm dark:border-amber-900/40 dark:from-amber-950/20 dark:via-slate-900 dark:to-sky-950/10">
				<div className="flex flex-col gap-2.5 md:flex-row md:items-start md:justify-between">
					<div>
						<div className="text-lg font-semibold text-slate-950 dark:text-slate-100">
							{STAKE_COPY.flowTitle}
						</div>
					</div>
					<div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-white/85 px-3 py-1 text-xs font-medium text-amber-800 shadow-sm dark:border-amber-800/60 dark:bg-slate-900/75 dark:text-amber-300">
						<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
							{activeFlowStep}
						</span>
						<span>{STAKE_COPY.currentStepLabel}</span>
						<span className="hidden h-1 w-1 rounded-full bg-amber-400 md:block dark:bg-amber-500" />
						<span className="hidden md:block">{currentStakeStageText}</span>
					</div>
				</div>
				<div className="mt-2.5 grid gap-2 md:grid-cols-4">
					{STAKE_FLOW_STEPS.map((step) => {
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
										{STAKE_COPY.currentStageBadge}
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
						<div className="text-xs text-slate-500 dark:text-slate-400">{STAKE_COPY.votesLabel}</div>
						<ShieldCheck className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-lg font-semibold leading-none text-slate-950 dark:text-slate-100">
						{formatEther(votesValue)} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-auto pt-1.5 text-xs text-slate-500 dark:text-slate-400">
						{STAKE_COPY.votesDescription}
					</div>
				</div>

				<div className="flex h-28 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-2.5 flex items-center justify-between">
						<div className="text-xs text-slate-500 dark:text-slate-400">{STAKE_COPY.activeStakeLabel}</div>
						<Coins className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-lg font-semibold leading-none text-slate-950 dark:text-slate-100">
						{formatEther(stakedValue)} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-auto pt-1.5 text-xs text-slate-500 dark:text-slate-400">
						{STAKE_COPY.activeStakeDescription}
					</div>
				</div>

				<div className="flex h-28 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-2.5 flex items-center justify-between">
						<div className="text-xs text-slate-500 dark:text-slate-400">{STAKE_COPY.pendingStakeLabel}</div>
						<Clock3 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-lg font-semibold leading-none text-slate-950 dark:text-slate-100">
						{formatEther(pendingStakeValue)} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-auto pt-1.5 text-xs text-slate-500 dark:text-slate-400">
						{hasPendingStake
							? activateRemainingBlocks > 0n
								? `${STAKE_COPY.activateWaitPrefix} ${activateRemainingBlocks.toString()} 个区块`
								: STAKE_COPY.canActivateNow
							: `${STAKE_COPY.defaultActivationWaitPrefix} ${activationBlocksValue.toString()} ${STAKE_COPY.defaultActivationWaitSuffix}`}
					</div>
				</div>

				<div className="flex h-28 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mb-2.5 flex items-center justify-between">
						<div className="text-xs text-slate-500 dark:text-slate-400">{STAKE_COPY.pendingWithdrawLabel}</div>
						<Wallet className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
					</div>
					<div className="text-lg font-semibold leading-none text-slate-950 dark:text-slate-100">
						{formatEther(pendingWithdrawValue)} {BRANDING.nativeTokenSymbol}
					</div>
					<div className="mt-auto pt-1.5 text-xs text-slate-500 dark:text-slate-400">
						{hasPendingWithdraw
							? withdrawRemainingSeconds > 0n
								? `${STAKE_COPY.withdrawWaitPrefix} ${formatStakeDuration(withdrawRemainingSeconds)}`
								: STAKE_COPY.pendingWithdrawReady
							: `${STAKE_COPY.defaultCooldownPrefix} ${formatStakeDuration(cooldownSecondsValue)}`}
					</div>
				</div>
			</section>

			<div className="grid gap-4 lg:grid-cols-2">
				<SectionCard
					title={STAKE_COPY.depositSectionTitle}
					description={STAKE_COPY.depositSectionDescription}
					className="p-5"
				>
					<div className="space-y-3">
						<input
							className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
							value={depositAmount}
							onChange={(event) => setDepositAmount(event.target.value)}
							placeholder={STAKE_COPY.depositInputPlaceholder}
						/>

						<div className="space-y-2">
							<div className="text-xs font-medium text-slate-500 dark:text-slate-400">
								{STAKE_COPY.walletQuickFillLabel}
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

						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
							<div>{STAKE_COPY.walletBalanceSummary}：{formatEther(walletBalanceValue)} {BRANDING.nativeTokenSymbol}</div>
							<div>{STAKE_COPY.pendingStakeSummary}：{formatEther(pendingStakeValue)} {BRANDING.nativeTokenSymbol}</div>
							<div>{STAKE_COPY.defaultActivationSummary}：{activationBlocksValue.toString()} 个区块</div>
							<div>{activateHelperText}</div>
						</div>

						<div className="flex flex-wrap gap-3">
							<button
								data-testid="stake-deposit-button"
								onClick={handleDeposit}
								disabled={depositDisabled}
								className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
							>
								{STAKE_COPY.depositButton}
							</button>
							<button
								data-testid="stake-activate-button"
								onClick={handleActivate}
								disabled={activateDisabled}
								className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								{STAKE_COPY.activateButton}
							</button>
							<button
								data-testid="stake-cancel-pending-button"
								onClick={handleCancelPendingStake}
								disabled={cancelPendingDisabled}
								className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								{STAKE_COPY.cancelPendingButton}
							</button>
						</div>
					</div>
				</SectionCard>

				<SectionCard
					title={STAKE_COPY.withdrawSectionTitle}
					description={STAKE_COPY.withdrawSectionDescription}
					className="p-5"
				>
					<div className="space-y-3">
						<input
							className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
							value={withdrawAmount}
							onChange={(event) => setWithdrawAmount(event.target.value)}
							placeholder={STAKE_COPY.withdrawInputPlaceholder}
						/>

						<div className="grid gap-2.5 md:grid-cols-2">
							<div className="space-y-2">
								<div className="text-xs font-medium text-slate-500 dark:text-slate-400">
									{STAKE_COPY.stakedQuickFillLabel}
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
										label={STAKE_COPY.fillAllStaked}
										onClick={() => applyQuickAmount(stakedValue, 1n, 1n, setWithdrawAmount)}
										disabled={stakedValue <= 0n}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<div className="text-xs font-medium text-slate-500 dark:text-slate-400">
									{STAKE_COPY.pendingWithdrawQuickFillLabel}
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
										label={STAKE_COPY.fillAllPendingWithdraw}
										onClick={() => applyQuickAmount(pendingWithdrawValue, 1n, 1n, setWithdrawAmount)}
										disabled={pendingWithdrawValue <= 0n}
									/>
								</div>
							</div>
						</div>

						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
							<div>{STAKE_COPY.cooldownSummary}：{formatStakeDuration(cooldownSecondsValue)}</div>
							<div>{withdrawHelperText}</div>
						</div>

						<div className="flex flex-wrap gap-3">
							<button
								data-testid="stake-request-withdraw-button"
								onClick={handleRequestWithdraw}
								disabled={requestWithdrawDisabled}
								className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								{STAKE_COPY.requestWithdrawButton}
							</button>
							<button
								data-testid="stake-withdraw-button"
								onClick={handleWithdraw}
								disabled={withdrawDisabled}
								className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
							>
								{STAKE_COPY.withdrawButton}
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



