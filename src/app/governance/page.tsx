"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useBlockNumber,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { toast } from "sonner";
import { ArrowRight, Coins, Clock3, ExternalLink, Gavel, Plus, Vote } from "lucide-react";

import {
  DraftActionEditor,
  DraftActionPreview,
  GovernanceMetricCard,
  PreviewStat,
  ProposalList,
} from "@/components/governance/governance-page-sections";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import {
  createGovernanceDraftAction,
  encodeGovernanceActionDraft,
  getGovernanceTemplateById,
  getGovernanceTemplates,
  validateGovernanceActionDraft,
} from "@/lib/governance-templates";
import { BRANDING } from "@/lib/branding";
import {
  GOVERNANCE_FLOW_STEPS,
  GOVERNANCE_PAGE_COPY,
  getActiveGovernanceStep,
  getCurrentGovernanceStageText,
  groupGovernanceTemplates,
  MAX_GOVERNANCE_DRAFT_ACTIONS,
  moveGovernanceItem,
} from "@/lib/governance-page-helpers";
import { reportClientError } from "@/lib/observability/client";
import { fetchParsedProposals } from "@/lib/proposal-events";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import { writeTxToast } from "@/lib/tx-toast";
import { asBigInt } from "@/lib/web3-types";
import type {
  GovernanceDraftAction,
  GovernanceTemplateDefinition,
  ProposalItem,
} from "@/types/governance";

type DraftActionState = {
  action: GovernanceDraftAction;
  template: GovernanceTemplateDefinition | null;
  validation:
    | { ok: true }
    | { ok: false; error: string };
  encodedAction:
    | ReturnType<typeof encodeGovernanceActionDraft>
    | null;
};

function explorerAddressUrl(address: string) {
  return `${BRANDING.explorerUrl}/address/${address}`;
}

function reportGovernancePageError(message: string, error: unknown) {
  void reportClientError({
    message,
    source: "governance.page",
    severity: "error",
    handled: true,
    error,
  });
}

export default function GovernancePage() {
  const { address } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const refreshAfterTx = useRefreshOnTxConfirmed();

  const [description, setDescription] = useState("提案：更新治理参数");
  const [draftActions, setDraftActions] = useState<GovernanceDraftAction[]>(() => [
    createGovernanceDraftAction("content.setRewardRules"),
  ]);
  const [highRiskConfirmed, setHighRiskConfirmed] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  const [liveBlockNumber, setLiveBlockNumber] = useState<bigint | undefined>(
    typeof blockNumber === "bigint" ? blockNumber : undefined
  );
  const latestProposal = proposals[0];

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
        // Keep the latest known block when polling fails transiently.
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

  const templates = useMemo(() => getGovernanceTemplates(), []);
  const groupedTemplates = useMemo(() => groupGovernanceTemplates(templates), [templates]);

  const { data: proposalThreshold, refetch: refetchProposalThreshold } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalThreshold",
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

  const { data: proposalFee, refetch: refetchProposalFee } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalFee",
  });

  const { data: latestProposalState, refetch: refetchLatestProposalState } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "state",
    args: latestProposal ? [latestProposal.proposalId] : undefined,
    query: { enabled: !!latestProposal },
  });

  const { data: latestProposalEta, refetch: refetchLatestProposalEta } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalEta",
    args: latestProposal ? [latestProposal.proposalId] : undefined,
    query: { enabled: !!latestProposal },
  });

  const draftStates = useMemo<DraftActionState[]>(() => {
    return draftActions.map((action) => {
      const template = getGovernanceTemplateById(action.templateId);
      const validation = validateGovernanceActionDraft(action);

      if (!validation.ok) {
        return {
          action,
          template,
          validation,
          encodedAction: null,
        };
      }

      try {
        return {
          action,
          template,
          validation,
          encodedAction: encodeGovernanceActionDraft(action),
        };
      } catch (error) {
        return {
          action,
          template,
          validation: {
            ok: false,
            error:
              error instanceof Error ? error.message : "提案动作编码失败",
          },
          encodedAction: null,
        };
      }
    });
  }, [draftActions]);

  const allActionsValid = draftStates.every((state) => state.validation.ok);
  const encodedActions = draftStates.flatMap((state) =>
    state.encodedAction ? [state.encodedAction] : []
  );
  const highRiskActionCount = encodedActions.filter(
    (action) => action.riskLevel === "high"
  ).length;
  const hasHighRiskAction = highRiskActionCount > 0;
  const trimmedDescription = description.trim();
  const latestProposalStateValue = asBigInt(latestProposalState);
  const latestProposalEtaValue = asBigInt(latestProposalEta);
  const activeGovernanceStep = useMemo(() => {
    return getActiveGovernanceStep({
      latestProposal,
      latestProposalStateValue,
      latestProposalEtaValue,
      liveBlockNumber,
      nowTs,
    });
  }, [
    latestProposal,
    latestProposalEtaValue,
    latestProposalStateValue,
    liveBlockNumber,
    nowTs,
  ]);
  const currentGovernanceStageText = useMemo(() => {
    return getCurrentGovernanceStageText({
      draftActionCount: draftActions.length,
      latestProposal,
      latestProposalEtaValue,
      latestProposalStateValue,
      nowTs,
      trimmedDescriptionLength: trimmedDescription.length,
    });
  }, [
    draftActions.length,
    latestProposal,
    latestProposalEtaValue,
    latestProposalStateValue,
    nowTs,
    trimmedDescription.length,
  ]);
  const canSubmitProposal =
    trimmedDescription.length > 0 &&
    draftActions.length > 0 &&
    allActionsValid &&
    proposalFee !== undefined &&
    (!hasHighRiskAction || highRiskConfirmed);

  useEffect(() => {
    if (!latestProposal || liveBlockNumber === undefined) {
      return;
    }

    void Promise.all([refetchLatestProposalState(), refetchLatestProposalEta()]);
  }, [
    latestProposal,
    liveBlockNumber,
    refetchLatestProposalEta,
    refetchLatestProposalState,
  ]);

  useEffect(() => {
    if (!hasHighRiskAction && highRiskConfirmed) {
      setHighRiskConfirmed(false);
    }
  }, [hasHighRiskAction, highRiskConfirmed]);

  const loadProposals = useCallback(async () => {
    if (!publicClient) return;

    setLoadingProposals(true);
    try {
      const parsed = (await fetchParsedProposals(publicClient)).reverse();
      setProposals(parsed);
    } catch (error) {
      reportGovernancePageError("Failed to load governance proposals", error);
      toast.error("加载提案列表失败");
    } finally {
      setLoadingProposals(false);
    }
  }, [publicClient]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  const governanceRefreshDomains = useMemo(
    () => ["governance", "system"] as const,
    []
  );

  const governanceRefetchers = useMemo(
    () => [
      loadProposals,
      refetchProposalThreshold,
      refetchProposalFee,
      refetchVotingDelay,
      refetchVotingPeriod,
    ],
    [
      loadProposals,
      refetchProposalFee,
      refetchProposalThreshold,
      refetchVotingDelay,
      refetchVotingPeriod,
    ]
  );

  useTxEventRefetch(governanceRefreshDomains, governanceRefetchers);

  function handleTemplateChange(actionId: string, templateId: string) {
    const nextDraft = createGovernanceDraftAction(templateId);

    setDraftActions((current) =>
      current.map((action) =>
        action.id === actionId
          ? {
              ...nextDraft,
              id: action.id,
            }
          : action
      )
    );
  }

  function handleFieldChange(
    actionId: string,
    key: string,
    value: string | boolean
  ) {
    setDraftActions((current) =>
      current.map((action) =>
        action.id === actionId
          ? {
              ...action,
              values: {
                ...action.values,
                [key]: value,
              },
            }
          : action
      )
    );
  }

  function handleAddAction() {
    if (draftActions.length >= MAX_GOVERNANCE_DRAFT_ACTIONS) {
      toast.error(`单个提案最多支持 ${MAX_GOVERNANCE_DRAFT_ACTIONS} 个动作`);
      return;
    }

    const fallbackTemplateId =
      draftActions[draftActions.length - 1]?.templateId ?? templates[0]?.id;

    setDraftActions((current) => [
      ...current,
      createGovernanceDraftAction(fallbackTemplateId),
    ]);
  }

  function handleRemoveAction(actionId: string) {
    setDraftActions((current) => current.filter((action) => action.id !== actionId));
  }

  function handleMoveAction(actionId: string, direction: "up" | "down") {
    setDraftActions((current) => {
      const index = current.findIndex((action) => action.id === actionId);
      if (index === -1) {
        return current;
      }

      if (direction === "up" && index > 0) {
        return moveGovernanceItem(current, index, index - 1);
      }

      if (direction === "down" && index < current.length - 1) {
        return moveGovernanceItem(current, index, index + 1);
      }

      return current;
    });
  }

  async function handlePropose() {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    if (!trimmedDescription) {
      toast.error("请输入提案描述");
      return;
    }

    if (draftStates.length === 0) {
      toast.error("请至少添加一个提案动作");
      return;
    }

    const invalidDraft = draftStates.find((state) => !state.validation.ok);
    if (invalidDraft && !invalidDraft.validation.ok) {
      toast.error(invalidDraft.validation.error);
      return;
    }

    if (hasHighRiskAction && !highRiskConfirmed) {
      toast.error("请先确认高风险治理动作");
      return;
    }

    if (proposalFee === undefined) {
      toast.error("提案费用尚未加载完成");
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
        request: {
          address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
          abi: ABIS.KnowledgeGovernor,
          functionName: "proposeWithFee",
          args: [
            encodedActions.map((item) => item.target),
            encodedActions.map((item) => item.value),
            encodedActions.map((item) => item.calldata),
            trimmedDescription,
          ],
          value: typeof proposalFee === "bigint" ? proposalFee : 0n,
          account: address,
        },
      loading: "正在提交提案...",
      success: "提案交易已提交",
      fail: "提案提交失败",
    });

    if (!hash) return;

    await refreshAfterTx(hash, loadProposals, ["governance", "system"]);
  }

  return (
    <main className="mx-auto max-w-375 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        eyebrow="Governor / Timelock / DAO"
        title={GOVERNANCE_PAGE_COPY.headerTitle}
        description={GOVERNANCE_PAGE_COPY.headerDescription}
        testId={PAGE_TEST_IDS.governance}
        right={
          <a
            href={explorerAddressUrl(CONTRACTS.KnowledgeGovernor)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            查看 Governor 合约
            <ExternalLink className="h-4 w-4" />
          </a>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_320px] xl:items-start">
        <div className="space-y-6">
          <section className="rounded-3xl border border-amber-200/70 bg-linear-to-r from-amber-50 via-white to-sky-50 p-3.5 shadow-sm dark:border-amber-900/40 dark:from-amber-950/20 dark:via-slate-900 dark:to-sky-950/10">
            <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                  Governance 操作路径
                </div>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-white/85 px-3 py-1 text-xs font-medium text-amber-800 shadow-sm dark:border-amber-800/60 dark:bg-slate-900/75 dark:text-amber-300">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                  {activeGovernanceStep}
                </span>
                <span>当前步骤</span>
                <span className="hidden h-1 w-1 rounded-full bg-amber-400 md:block dark:bg-amber-500" />
                <span className="hidden md:block">{currentGovernanceStageText}</span>
              </div>
            </div>
            <div className="mt-2.5 grid gap-2 md:grid-cols-4">
              {GOVERNANCE_FLOW_STEPS.map((step, index) => {
                const isActive = step.step === activeGovernanceStep;
                return (
                  <div
                    key={step.step}
                    className={`rounded-2xl border px-3.5 py-3 transition ${
                      isActive
                        ? "border-amber-300 bg-white shadow-sm dark:border-amber-700 dark:bg-slate-900"
                        : "border-white/70 bg-white/60 dark:border-slate-800 dark:bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-slate-950 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
                          {step.step}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Step {step.step}
                          </div>
                          <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                            {step.title}
                          </div>
                        </div>
                      </div>
                      {index < GOVERNANCE_FLOW_STEPS.length - 1 ? (
                        <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-300 md:block dark:text-slate-700" />
                      ) : null}
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

          <SectionCard
            title={GOVERNANCE_PAGE_COPY.listTitle}
            description={GOVERNANCE_PAGE_COPY.listDescription}
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <PreviewStat label="当前提案" value={String(proposals.length)} />
              <PreviewStat label="已配置动作" value={String(draftActions.length)} />
              <PreviewStat label="高风险动作" value={String(highRiskActionCount)} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="h-136 overflow-y-auto pr-1 sm:h-152 xl:h-176">
              <ProposalList
                proposals={proposals}
                loading={loadingProposals}
                currentBlock={liveBlockNumber}
                nowTs={nowTs}
              />
              </div>
            </div>
          </SectionCard>

          <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.95fr)] 2xl:items-stretch">
            <SectionCard
              title={GOVERNANCE_PAGE_COPY.createTitle}
              description={GOVERNANCE_PAGE_COPY.createDescription}
              className="h-208"
              bodyClassName="flex min-h-0 flex-col"
            >
              <div className="flex min-h-0 flex-1 flex-col gap-5">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    提案描述
                  </div>
                  <textarea
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                    rows={2}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="描述这份治理提案的目标、影响范围与预期结果"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      提案动作
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      当前 {draftActions.length} / {MAX_GOVERNANCE_DRAFT_ACTIONS} 个动作
                    </div>
                  </div>

                  <button
                    onClick={handleAddAction}
                    disabled={draftActions.length >= MAX_GOVERNANCE_DRAFT_ACTIONS}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                    新增动作
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
                  {draftStates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                      当前还没有提案动作，请先添加至少一个治理动作。
                    </div>
                  ) : (
                    <div className="h-full space-y-4 overflow-y-auto pr-1">
                      {draftStates.map((state, index) => (
                        <DraftActionEditor
                          key={state.action.id}
                          index={index}
                          action={state.action}
                          template={state.template}
                          validation={state.validation}
                          groupedTemplates={groupedTemplates}
                          totalActions={draftStates.length}
                          onTemplateChange={handleTemplateChange}
                          onFieldChange={handleFieldChange}
                          onMoveAction={handleMoveAction}
                          onRemoveAction={handleRemoveAction}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {hasHighRiskAction ? (
                  <label className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                      checked={highRiskConfirmed}
                      onChange={(event) => setHighRiskConfirmed(event.target.checked)}
                    />
                    <span>
                      这份提案包含高风险治理动作，可能影响核心治理参数或执行延迟。我已核对目标合约、输入参数和预期影响。
                    </span>
                  </label>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    提案费用
                  </div>
                  <div className="mt-1">
                    {typeof proposalFee === "bigint"
                      ? proposalFee > 0n
                        ? `${formatEther(proposalFee)} ${BRANDING.nativeTokenSymbol}`
                        : "当前免费"
                      : "正在读取费用..."}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    发起提案时会将这笔费用转入协议金库，用于抑制低成本垃圾提案。
                  </div>
                </div>

                <button
                  data-testid="governance-propose-button"
                  onClick={handlePropose}
                  disabled={!canSubmitProposal}
                  className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                >
                  发起提案
                </button>
              </div>
            </SectionCard>

            <SectionCard
              title={GOVERNANCE_PAGE_COPY.previewTitle}
              description={GOVERNANCE_PAGE_COPY.previewDescription}
              className="h-208"
              bodyClassName="flex min-h-0 flex-col"
            >
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <PreviewStat label="动作数量" value={String(draftActions.length)} />
                  <PreviewStat label="有效动作" value={String(encodedActions.length)} />
                  <PreviewStat label="高风险动作" value={String(highRiskActionCount)} />
                </div>

                {!trimmedDescription ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                    请输入提案描述，预览区会更完整地反映最终提交内容。
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Proposal Description
                    </div>
                    <div className="mt-1">{trimmedDescription}</div>
                  </div>
                )}

                <div className="min-h-0 flex-1 overflow-hidden">
                  <div className="h-full space-y-4 overflow-y-auto pr-1">
                    {draftStates.map((state, index) => (
                      <DraftActionPreview
                        key={state.action.id}
                        index={index}
                        template={state.template}
                        validation={state.validation}
                        encodedAction={state.encodedAction}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          </section>
        </div>
        <div className="space-y-6 xl:sticky xl:top-6">
          <SectionCard
            title={GOVERNANCE_PAGE_COPY.paramsTitle}
            description={GOVERNANCE_PAGE_COPY.paramsDescription}
          >
            <div className="space-y-3">
              <GovernanceMetricCard
                icon={<Gavel className="h-5 w-5 text-slate-500 dark:text-slate-400" />}
                label="提案门槛"
                value={
                  proposalThreshold
                    ? `${formatEther(proposalThreshold as bigint)} ${BRANDING.nativeTokenSymbol}`
                    : "-"
                }
                description="创建提案所需的最低投票权。"
              />

              <GovernanceMetricCard
                icon={<Coins className="h-5 w-5 text-slate-500 dark:text-slate-400" />}
                label="提案费用"
                value={
                  typeof proposalFee === "bigint"
                    ? proposalFee > 0n
                      ? `${formatEther(proposalFee)} ${BRANDING.nativeTokenSymbol}`
                      : "当前免费"
                    : "-"
                }
                description="提交提案时需要附带的协议费用，会直接转入 Revenue Vault。"
              />

              <GovernanceMetricCard
                icon={<Clock3 className="h-5 w-5 text-slate-500 dark:text-slate-400" />}
                label="投票延迟"
                value={votingDelay ? String(votingDelay) : "-"}
                description="提案创建后到投票开始前需要等待的区块数。"
              />

              <GovernanceMetricCard
                icon={<Vote className="h-5 w-5 text-slate-500 dark:text-slate-400" />}
                label="投票周期"
                value={votingPeriod ? String(votingPeriod) : "-"}
                description="提案保持可投票状态的持续区块数。"
              />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Governor合约地址
                </div>
                <div className="mt-2 break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                  {CONTRACTS.KnowledgeGovernor}
                </div>
                <a
                  href={explorerAddressUrl(CONTRACTS.KnowledgeGovernor)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-900 transition hover:text-slate-600 dark:text-slate-100 dark:hover:text-slate-300"
                >
                  在浏览器中查看
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}

