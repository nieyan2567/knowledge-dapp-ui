"use client";

/**
 * @file 系统信息页面，集中展示当前部署环境下的核心合约地址和关键只读参数。
 */
import { useMemo, type ReactNode } from "react";
import { formatEther } from "viem";
import { useReadContract } from "wagmi";

import { AddressBadge } from "@/components/address-badge";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { BRANDING } from "@/lib/branding";
import { formatSystemBoolean, SYSTEM_PAGE_COPY } from "@/lib/system-page-helpers";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import { asBigInt } from "@/lib/web3-types";

/**
 * @notice 构造区块浏览器中的地址详情页链接。
 * @param address 目标地址。
 * @returns 地址详情页链接。
 */
function explorerAddressUrl(address: string) {
  return `${BRANDING.explorerUrl}/address/${address}`;
}

/**
 * @notice 将链上金额格式化为带代币符号的字符串。
 * @param value 原始 bigint 金额。
 * @returns 适合页面展示的金额文本。
 */
function formatTokenAmount(value: bigint | undefined) {
  return value !== undefined
    ? `${formatEther(value)} ${BRANDING.nativeTokenSymbol}`
    : "-";
}

/**
 * @notice 将区块高度类参数转换为文本。
 * @param value 原始 bigint 值。
 * @returns 带区块单位的展示文本。
 */
function formatBlocks(value: bigint | undefined) {
  return value !== undefined ? `${value.toString()} ${SYSTEM_PAGE_COPY.blockUnit}` : "-";
}

/**
 * @notice 将秒数类参数转换为文本。
 * @param value 原始 bigint 值。
 * @returns 带秒单位的展示文本。
 */
function formatSeconds(value: bigint | undefined) {
  return value !== undefined ? `${value.toString()} ${SYSTEM_PAGE_COPY.secondsUnit}` : "-";
}

/**
 * @notice 渲染系统信息页面。
 * @returns 七个核心合约及其只读参数的一览页。
 */
export default function SystemPage() {
  const { data: nativeVotesOwner, refetch: refetchNativeVotesOwner } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "owner",
  });
  const { data: activationBlocks, refetch: refetchActivationBlocks } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "activationBlocks",
  });
  const { data: cooldownSeconds, refetch: refetchCooldownSeconds } = useReadContract({
    address: CONTRACTS.NativeVotes as `0x${string}`,
    abi: ABIS.NativeVotes,
    functionName: "cooldownSeconds",
  });

  const { data: contentOwner, refetch: refetchContentOwner } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "owner",
  });
  const { data: votesContract, refetch: refetchVotesContract } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "votesContract",
  });
  const { data: treasury, refetch: refetchTreasury } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "treasury",
  });
  const { data: editLockVotes, refetch: refetchEditLockVotes } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "editLockVotes",
  });
  const {
    data: allowDeleteAfterVote,
    refetch: refetchAllowDeleteAfterVote,
  } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "allowDeleteAfterVote",
  });
  const {
    data: maxVersionsPerContent,
    refetch: refetchMaxVersionsPerContent,
  } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "maxVersionsPerContent",
  });
  const { data: registerFee, refetch: refetchRegisterFee } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "registerFee",
  });
  const { data: updateFee, refetch: refetchUpdateFee } = useReadContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "updateFee",
  });

  const { data: treasuryOwner, refetch: refetchTreasuryOwner } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "owner",
  });
  const { data: epochBudget, refetch: refetchEpochBudget } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "epochBudget",
  });
  const { data: epochSpent, refetch: refetchEpochSpent } = useReadContract({
    address: CONTRACTS.TreasuryNative as `0x${string}`,
    abi: ABIS.TreasuryNative,
    functionName: "epochSpent",
  });
  const { data: treasuryEpochDuration, refetch: refetchTreasuryEpochDuration } =
    useReadContract({
      address: CONTRACTS.TreasuryNative as `0x${string}`,
      abi: ABIS.TreasuryNative,
      functionName: "epochDuration",
    });

  const { data: faucetOwner, refetch: refetchFaucetOwner } = useReadContract({
    address: CONTRACTS.FaucetVault as `0x${string}`,
    abi: ABIS.FaucetVault,
    functionName: "owner",
  });
  const { data: faucetSigner, refetch: refetchFaucetSigner } = useReadContract({
    address: CONTRACTS.FaucetVault as `0x${string}`,
    abi: ABIS.FaucetVault,
    functionName: "signer",
  });
  const { data: faucetClaimAmount, refetch: refetchFaucetClaimAmount } = useReadContract({
    address: CONTRACTS.FaucetVault as `0x${string}`,
    abi: ABIS.FaucetVault,
    functionName: "claimAmount",
  });
  const { data: faucetEpochBudget, refetch: refetchFaucetEpochBudget } = useReadContract({
    address: CONTRACTS.FaucetVault as `0x${string}`,
    abi: ABIS.FaucetVault,
    functionName: "epochBudget",
  });
  const { data: faucetEpochSpent, refetch: refetchFaucetEpochSpent } = useReadContract({
    address: CONTRACTS.FaucetVault as `0x${string}`,
    abi: ABIS.FaucetVault,
    functionName: "epochSpent",
  });
  const { data: faucetEpochDuration, refetch: refetchFaucetEpochDuration } =
    useReadContract({
      address: CONTRACTS.FaucetVault as `0x${string}`,
      abi: ABIS.FaucetVault,
      functionName: "epochDuration",
    });
  const { data: faucetPaused, refetch: refetchFaucetPaused } = useReadContract({
    address: CONTRACTS.FaucetVault as `0x${string}`,
    abi: ABIS.FaucetVault,
    functionName: "paused",
  });

  const { data: revenueVaultOwner, refetch: refetchRevenueVaultOwner } = useReadContract({
    address: CONTRACTS.RevenueVault as `0x${string}`,
    abi: ABIS.RevenueVault,
    functionName: "owner",
  });
  const {
    data: revenueVaultTreasury,
    refetch: refetchRevenueVaultTreasury,
  } = useReadContract({
    address: CONTRACTS.RevenueVault as `0x${string}`,
    abi: ABIS.RevenueVault,
    functionName: "treasury",
  });

  const { data: governorToken, refetch: refetchGovernorToken } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "token",
  });
  const { data: proposalThreshold, refetch: refetchProposalThreshold } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalThreshold",
  });
  const { data: proposalFee, refetch: refetchProposalFee } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalFee",
  });
  const { data: votingDelay, refetch: refetchVotingDelay } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "votingDelay",
  });
  const { data: votingPeriod, refetch: refetchVotingPeriod } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "votingPeriod",
  });
  const {
    data: lateQuorumVoteExtension,
    refetch: refetchLateQuorumVoteExtension,
  } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "lateQuorumVoteExtension",
  });
  const { data: quorumNumerator, refetch: refetchQuorumNumerator } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "quorumNumerator",
  });
  const {
    data: quorumDenominator,
    refetch: refetchQuorumDenominator,
  } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "quorumDenominator",
  });

  const { data: minDelay, refetch: refetchMinDelay } = useReadContract({
    address: CONTRACTS.TimelockController as `0x${string}`,
    abi: ABIS.TimelockController,
    functionName: "getMinDelay",
  });

  const systemRefreshDomains = useMemo(
    () => ["rewards", "content", "governance", "system", "stake"] as const,
    [],
  );

  const systemRefetchers = useMemo(
    () => [
      refetchNativeVotesOwner,
      refetchActivationBlocks,
      refetchCooldownSeconds,
      refetchContentOwner,
      refetchVotesContract,
      refetchTreasury,
      refetchEditLockVotes,
      refetchAllowDeleteAfterVote,
      refetchMaxVersionsPerContent,
      refetchRegisterFee,
      refetchUpdateFee,
      refetchTreasuryOwner,
      refetchEpochBudget,
      refetchEpochSpent,
      refetchTreasuryEpochDuration,
      refetchFaucetOwner,
      refetchFaucetSigner,
      refetchFaucetClaimAmount,
      refetchFaucetEpochBudget,
      refetchFaucetEpochSpent,
      refetchFaucetEpochDuration,
      refetchFaucetPaused,
      refetchRevenueVaultOwner,
      refetchRevenueVaultTreasury,
      refetchGovernorToken,
      refetchProposalThreshold,
      refetchProposalFee,
      refetchVotingDelay,
      refetchVotingPeriod,
      refetchLateQuorumVoteExtension,
      refetchQuorumNumerator,
      refetchQuorumDenominator,
      refetchMinDelay,
    ],
    [
      refetchNativeVotesOwner,
      refetchActivationBlocks,
      refetchCooldownSeconds,
      refetchContentOwner,
      refetchVotesContract,
      refetchTreasury,
      refetchEditLockVotes,
      refetchAllowDeleteAfterVote,
      refetchMaxVersionsPerContent,
      refetchRegisterFee,
      refetchUpdateFee,
      refetchTreasuryOwner,
      refetchEpochBudget,
      refetchEpochSpent,
      refetchTreasuryEpochDuration,
      refetchFaucetOwner,
      refetchFaucetSigner,
      refetchFaucetClaimAmount,
      refetchFaucetEpochBudget,
      refetchFaucetEpochSpent,
      refetchFaucetEpochDuration,
      refetchFaucetPaused,
      refetchRevenueVaultOwner,
      refetchRevenueVaultTreasury,
      refetchGovernorToken,
      refetchProposalThreshold,
      refetchProposalFee,
      refetchVotingDelay,
      refetchVotingPeriod,
      refetchLateQuorumVoteExtension,
      refetchQuorumNumerator,
      refetchQuorumDenominator,
      refetchMinDelay,
    ],
  );

  useTxEventRefetch(systemRefreshDomains, systemRefetchers);

  const activationBlocksValue = asBigInt(activationBlocks);
  const cooldownSecondsValue = asBigInt(cooldownSeconds);
  const registerFeeValue = asBigInt(registerFee);
  const updateFeeValue = asBigInt(updateFee);
  const treasuryEpochBudgetValue = asBigInt(epochBudget);
  const treasuryEpochSpentValue = asBigInt(epochSpent);
  const treasuryEpochDurationValue = asBigInt(treasuryEpochDuration);
  const faucetClaimAmountValue = asBigInt(faucetClaimAmount);
  const faucetEpochBudgetValue = asBigInt(faucetEpochBudget);
  const faucetEpochSpentValue = asBigInt(faucetEpochSpent);
  const faucetEpochDurationValue = asBigInt(faucetEpochDuration);
  const proposalThresholdValue = asBigInt(proposalThreshold);
  const proposalFeeValue = asBigInt(proposalFee);
  const votingDelayValue = asBigInt(votingDelay);
  const votingPeriodValue = asBigInt(votingPeriod);
  const lateQuorumVoteExtensionValue = asBigInt(lateQuorumVoteExtension);
  const quorumNumeratorValue = asBigInt(quorumNumerator);
  const quorumDenominatorValue = asBigInt(quorumDenominator);
  const minDelayValue = asBigInt(minDelay);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        eyebrow={SYSTEM_PAGE_COPY.headerEyebrow}
        title={SYSTEM_PAGE_COPY.headerTitle}
        description={SYSTEM_PAGE_COPY.headerDescription}
        testId={PAGE_TEST_IDS.system}
        right={
          <a
            href={BRANDING.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {SYSTEM_PAGE_COPY.openExplorer}
          </a>
        }
      />

      <div className="grid gap-4">
        <ContractCard title="NativeVotes" address={CONTRACTS.NativeVotes}>
          <SystemRow label={SYSTEM_PAGE_COPY.contractAddress}>
            <AddressBadge address={CONTRACTS.NativeVotes} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.owner}>
            <AddressBadge address={String(nativeVotesOwner ?? "")} />
          </SystemRow>
          <SystemRow label="激活等待区块">{formatBlocks(activationBlocksValue)}</SystemRow>
          <SystemRow label="退出冷却期">{formatSeconds(cooldownSecondsValue)}</SystemRow>
        </ContractCard>

        <ContractCard title="KnowledgeContent" address={CONTRACTS.KnowledgeContent}>
          <SystemRow label={SYSTEM_PAGE_COPY.contractAddress}>
            <AddressBadge address={CONTRACTS.KnowledgeContent} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.owner}>
            <AddressBadge address={String(contentOwner ?? "")} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.votesContract}>
            <AddressBadge address={String(votesContract ?? "")} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.treasuryContract}>
            <AddressBadge address={String(treasury ?? "")} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.editLockVotes}>
            {editLockVotes ? String(editLockVotes) : "-"}
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.allowDeleteAfterVote}>
            {formatSystemBoolean(allowDeleteAfterVote)}
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.maxVersionsPerContent}>
            {maxVersionsPerContent ? String(maxVersionsPerContent) : "-"}
          </SystemRow>
          <SystemRow label="发布费用">{formatTokenAmount(registerFeeValue)}</SystemRow>
          <SystemRow label="更新费用">{formatTokenAmount(updateFeeValue)}</SystemRow>
        </ContractCard>

        <ContractCard title="TreasuryNative" address={CONTRACTS.TreasuryNative}>
          <SystemRow label={SYSTEM_PAGE_COPY.contractAddress}>
            <AddressBadge address={CONTRACTS.TreasuryNative} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.owner}>
            <AddressBadge address={String(treasuryOwner ?? "")} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.cycleBudget}>
            {formatTokenAmount(treasuryEpochBudgetValue)}
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.cycleSpent}>
            {formatTokenAmount(treasuryEpochSpentValue)}
          </SystemRow>
          <SystemRow label="预算周期">{formatSeconds(treasuryEpochDurationValue)}</SystemRow>
        </ContractCard>

        <ContractCard title="FaucetVault" address={CONTRACTS.FaucetVault}>
          <SystemRow label={SYSTEM_PAGE_COPY.contractAddress}>
            <AddressBadge address={CONTRACTS.FaucetVault} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.owner}>
            <AddressBadge address={String(faucetOwner ?? "")} />
          </SystemRow>
          <SystemRow label="授权签名人">
            <AddressBadge address={String(faucetSigner ?? "")} />
          </SystemRow>
          <SystemRow label="单次发放额度">{formatTokenAmount(faucetClaimAmountValue)}</SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.cycleBudget}>
            {formatTokenAmount(faucetEpochBudgetValue)}
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.cycleSpent}>
            {formatTokenAmount(faucetEpochSpentValue)}
          </SystemRow>
          <SystemRow label="预算周期">{formatSeconds(faucetEpochDurationValue)}</SystemRow>
          <SystemRow label="暂停状态">{formatSystemBoolean(faucetPaused)}</SystemRow>
        </ContractCard>

        <ContractCard title="RevenueVault" address={CONTRACTS.RevenueVault}>
          <SystemRow label={SYSTEM_PAGE_COPY.contractAddress}>
            <AddressBadge address={CONTRACTS.RevenueVault} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.owner}>
            <AddressBadge address={String(revenueVaultOwner ?? "")} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.treasuryContract}>
            <AddressBadge address={String(revenueVaultTreasury ?? "")} />
          </SystemRow>
        </ContractCard>

        <ContractCard title="KnowledgeGovernor" address={CONTRACTS.KnowledgeGovernor}>
          <SystemRow label={SYSTEM_PAGE_COPY.contractAddress}>
            <AddressBadge address={CONTRACTS.KnowledgeGovernor} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.governanceToken}>
            <AddressBadge address={String(governorToken ?? "")} />
          </SystemRow>
          <SystemRow label="提案门槛">{formatTokenAmount(proposalThresholdValue)}</SystemRow>
          <SystemRow label="提案费用">{formatTokenAmount(proposalFeeValue)}</SystemRow>
          <SystemRow label="投票延迟">{formatBlocks(votingDelayValue)}</SystemRow>
          <SystemRow label="投票周期">{formatBlocks(votingPeriodValue)}</SystemRow>
          <SystemRow label="法定人数比例">
            {quorumNumeratorValue !== undefined && quorumDenominatorValue !== undefined
              ? `${quorumNumeratorValue.toString()} / ${quorumDenominatorValue.toString()}`
              : "-"}
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.lateQuorumExtension}>
            {formatBlocks(lateQuorumVoteExtensionValue)}
          </SystemRow>
        </ContractCard>

        <ContractCard title="TimelockController" address={CONTRACTS.TimelockController}>
          <SystemRow label={SYSTEM_PAGE_COPY.contractAddress}>
            <AddressBadge address={CONTRACTS.TimelockController} />
          </SystemRow>
          <SystemRow label={SYSTEM_PAGE_COPY.minDelay}>{formatSeconds(minDelayValue)}</SystemRow>
        </ContractCard>
      </div>
    </main>
  );
}

/**
 * @notice 渲染单个合约信息卡。
 * @param title 卡片标题。
 * @param address 合约地址。
 * @param children 卡片中的字段行。
 * @returns 统一样式的长方形信息卡。
 */
function ContractCard({
  title,
  address,
  children,
}: {
  title: string;
  address: string;
  children: ReactNode;
}) {
  return (
    <SectionCard
      title={title}
      className="rounded-2xl px-5 py-4 shadow-none"
      bodyClassName="space-y-0"
      headerRight={<SystemExplorerLink address={address} />}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
        {children}
      </div>
    </SectionCard>
  );
}

/**
 * @notice 渲染系统卡片中的单行字段。
 * @param label 左侧字段名。
 * @param children 右侧字段值。
 * @returns 一行一条的字段行。
 */
function SystemRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 last:border-b-0 dark:border-slate-800">
      <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <div className="min-w-0 text-right text-sm font-medium text-slate-900 dark:text-slate-100">
        {children}
      </div>
    </div>
  );
}

/**
 * @notice 渲染系统地址对应的区块浏览器外链。
 * @param address 目标地址。
 * @returns 浏览器地址链接按钮。
 */
function SystemExplorerLink({ address }: { address: string }) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {SYSTEM_PAGE_COPY.explorerAction}
    </a>
  );
}
