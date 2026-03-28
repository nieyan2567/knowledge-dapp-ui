"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useBlockNumber,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  ExternalLink,
  Gavel,
  Plus,
  Trash2,
  Vote,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import { collectByBlockRange } from "@/lib/block-range";
import {
  createGovernanceDraftAction,
  encodeGovernanceActionDraft,
  formatGovernanceTemplateTarget,
  getGovernanceTemplateById,
  getGovernanceTemplates,
  getRiskBadgeClass,
  getRiskLabel,
  validateGovernanceActionDraft,
} from "@/lib/governance-templates";
import {
  formatProposalBlockRange,
  getProposalStageCountdown,
  governanceStateBadgeClass as stateBadgeClass,
  governanceStateLabel as stateLabel,
  parseProposalCreatedLog,
  proposalCreatedEvent,
  summarizeProposalActions,
} from "@/lib/governance";
import { BRANDING } from "@/lib/branding";
import { reportClientError } from "@/lib/observability/client";
import { writeTxToast } from "@/lib/tx-toast";
import { asBigInt, asProposalVotes } from "@/lib/web3-types";
import type {
  GovernanceDraftAction,
  GovernanceTemplateCategory,
  GovernanceTemplateDefinition,
  GovernanceTemplateField,
  ProposalItem,
  ProposalVotes,
} from "@/types/governance";

const MAX_DRAFT_ACTIONS = 5;

const CATEGORY_LABELS: Record<GovernanceTemplateCategory, string> = {
  content: "Content",
  stake: "Stake",
  treasury: "Treasury",
  governor: "Governor",
  timelock: "Timelock",
};

const GOVERNANCE_FLOW_STEPS = [
  {
    step: "01",
    title: "配置提案动作",
    description: "从治理模板中组合链上动作，明确要修改的规则与参数。",
  },
  {
    step: "02",
    title: "提交并进入投票",
    description: "提案达到门槛后发起，经过 voting delay 后进入投票阶段。",
  },
  {
    step: "03",
    title: "通过后排队",
    description: "成功提案会进入 Timelock 队列，等待最小延迟结束。",
  },
  {
    step: "04",
    title: "执行生效",
    description: "队列完成后执行提案，治理参数和系统配置正式更新。",
  },
] as const;

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

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function explorerAddressUrl(address: string) {
  return `${BRANDING.explorerUrl}/address/${address}`;
}

function formatBlockRange(start?: bigint, end?: bigint) {
  return formatProposalBlockRange(start, end);
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

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);

  if (item === undefined) {
    return items;
  }

  next.splice(toIndex, 0, item);
  return next;
}

function getCategoryOrder(category: GovernanceTemplateCategory) {
  switch (category) {
    case "content":
      return 0;
    case "stake":
      return 1;
    case "treasury":
      return 2;
    case "governor":
      return 3;
    case "timelock":
      return 4;
    default:
      return 999;
  }
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
  const groupedTemplates = useMemo(() => {
    return Object.entries(
      templates.reduce<Record<GovernanceTemplateCategory, GovernanceTemplateDefinition[]>>(
        (groups, template) => {
          groups[template.category].push(template);
          return groups;
        },
        {
          content: [],
          stake: [],
          treasury: [],
          governor: [],
          timelock: [],
        }
      )
    )
      .filter(([, items]) => items.length > 0)
      .sort(([left], [right]) =>
        getCategoryOrder(left as GovernanceTemplateCategory) -
        getCategoryOrder(right as GovernanceTemplateCategory)
      ) as Array<[GovernanceTemplateCategory, GovernanceTemplateDefinition[]]>;
  }, [templates]);

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
  const canSubmitProposal =
    trimmedDescription.length > 0 &&
    draftActions.length > 0 &&
    allActionsValid &&
    (!hasHighRiskAction || highRiskConfirmed);

  useEffect(() => {
    if (!hasHighRiskAction && highRiskConfirmed) {
      setHighRiskConfirmed(false);
    }
  }, [hasHighRiskAction, highRiskConfirmed]);

  const loadProposals = useCallback(async () => {
    if (!publicClient) return;

    setLoadingProposals(true);
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const logs = await collectByBlockRange({
        toBlock: latestBlock,
        fetchRange: ({ fromBlock, toBlock }) =>
          publicClient.getLogs({
            address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
            event: proposalCreatedEvent,
            fromBlock,
            toBlock,
          }),
      });

      const parsed = logs.map((log) => parseProposalCreatedLog(log)).reverse();
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
      refetchVotingDelay,
      refetchVotingPeriod,
    ],
    [loadProposals, refetchProposalThreshold, refetchVotingDelay, refetchVotingPeriod]
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
    if (draftActions.length >= MAX_DRAFT_ACTIONS) {
      toast.error(`单个提案最多支持 ${MAX_DRAFT_ACTIONS} 个动作`);
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
        return moveItem(current, index, index - 1);
      }

      if (direction === "down" && index < current.length - 1) {
        return moveItem(current, index, index + 1);
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

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "propose",
        args: [
          encodedActions.map((item) => item.target),
          encodedActions.map((item) => item.value),
          encodedActions.map((item) => item.calldata),
          trimmedDescription,
        ],
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
        title="Governance Center"
        description="在同一页面查看治理流程、浏览提案、核对参数，并完成提案创建与提交前确认。"
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
          <SectionCard
            title="操作流程"
            description="先配置治理动作，再发起提案并投票，成功后经 Timelock 排队，最终执行生效。"
          >
            <div className="grid gap-4 lg:grid-cols-4">
              {GOVERNANCE_FLOW_STEPS.map((item) => (
                <GovernanceFlowStep
                  key={item.step}
                  step={item.step}
                  title={item.title}
                  description={item.description}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="提案列表"
            description="这里集中展示全部治理提案，支持滚动浏览状态、投票进度与后续处理阶段。"
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
              title="创建提案"
              description="在一个提案里组合多个治理动作，按执行顺序发起链上变更。"
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
                      当前 {draftActions.length} / {MAX_DRAFT_ACTIONS} 个动作
                    </div>
                  </div>

                  <button
                    onClick={handleAddAction}
                    disabled={draftActions.length >= MAX_DRAFT_ACTIONS}
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
              title="提交前预览"
              description="这里会按顺序展示最终要写入 Governor.propose 的目标地址、编码动作与风险等级。"
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
            title="治理参数"
            description="展示当前治理所需的关键参数，便于在配置提案时随时参考。"
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

function GovernanceFlowStep({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-linear-to-br from-white to-slate-50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
          {step}
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
          Flow
        </span>
      </div>
      <div className="text-base font-semibold text-slate-950 dark:text-slate-100">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
        {description}
      </div>
    </div>
  );
}

function GovernanceMetricCard({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        {icon}
      </div>
      <div className="text-xl font-semibold text-slate-950 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </div>
    </div>
  );
}

function DraftActionEditor({
  index,
  action,
  template,
  validation,
  groupedTemplates,
  totalActions,
  onTemplateChange,
  onFieldChange,
  onMoveAction,
  onRemoveAction,
}: {
  index: number;
  action: GovernanceDraftAction;
  template: GovernanceTemplateDefinition | null;
  validation: { ok: true } | { ok: false; error: string };
  groupedTemplates: Array<[GovernanceTemplateCategory, GovernanceTemplateDefinition[]]>;
  totalActions: number;
  onTemplateChange: (actionId: string, templateId: string) => void;
  onFieldChange: (
    actionId: string,
    key: string,
    value: string | boolean
  ) => void;
  onMoveAction: (actionId: string, direction: "up" | "down") => void;
  onRemoveAction: (actionId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            动作 #{index + 1}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {template?.description ?? "请选择一个治理模板。"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {template ? (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${getRiskBadgeClass(
                template.riskLevel
              )}`}
            >
              {getRiskLabel(template.riskLevel)}
            </span>
          ) : null}

          <button
            onClick={() => onMoveAction(action.id, "up")}
            disabled={index === 0}
            className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Move action up"
          >
            <ArrowUp className="h-4 w-4" />
          </button>

          <button
            onClick={() => onMoveAction(action.id, "down")}
            disabled={index === totalActions - 1}
            className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Move action down"
          >
            <ArrowDown className="h-4 w-4" />
          </button>

          <button
            onClick={() => onRemoveAction(action.id)}
            disabled={totalActions === 1}
            className="rounded-lg border border-rose-300 p-2 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
            aria-label="Remove action"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            提案类型
          </div>
          <select
            value={action.templateId}
            onChange={(event) => onTemplateChange(action.id, event.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-400"
          >
            {groupedTemplates.map(([category, templates]) => (
              <optgroup key={category} label={CATEGORY_LABELS[category]}>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {template?.fields.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {template.fields.map((field) => (
              <GovernanceFieldEditor
                key={field.key}
                actionId={action.id}
                field={field}
                value={action.values[field.key]}
                onFieldChange={onFieldChange}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
            这个模板没有额外参数，提交时会直接编码对应的函数调用。
          </div>
        )}

        {!validation.ok ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            {validation.error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GovernanceFieldEditor({
  actionId,
  field,
  value,
  onFieldChange,
}: {
  actionId: string;
  field: GovernanceTemplateField;
  value: string | boolean | undefined;
  onFieldChange: (
    actionId: string,
    key: string,
    value: string | boolean
  ) => void;
}) {
  const sharedClassName =
    "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-400";

  return (
    <div className={field.type === "boolean" ? "md:col-span-2" : undefined}>
      <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        {field.label}
      </div>

      {field.type === "boolean" ? (
        <label className="flex items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
          <span>{field.description ?? "切换该参数的开关状态。"}</span>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) =>
              onFieldChange(actionId, field.key, event.target.checked)
            }
            className="h-4 w-4 rounded border-slate-300"
          />
        </label>
      ) : field.type === "select" ? (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            onFieldChange(actionId, field.key, event.target.value)
          }
          className={sharedClassName}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            onFieldChange(actionId, field.key, event.target.value)
          }
          placeholder={field.placeholder}
          className={sharedClassName}
        />
      )}

      {field.description && field.type !== "boolean" ? (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {field.description}
        </div>
      ) : null}
    </div>
  );
}

function DraftActionPreview({
  index,
  template,
  validation,
  encodedAction,
}: {
  index: number;
  template: GovernanceTemplateDefinition | null;
  validation: { ok: true } | { ok: false; error: string };
  encodedAction: ReturnType<typeof encodeGovernanceActionDraft> | null;
}) {
  if (!template) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
        动作 #{index + 1} 还没有选择模板。
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            动作 #{index + 1}: {template.label}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            目标合约: {formatGovernanceTemplateTarget(template.target)}
          </div>
        </div>

        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${getRiskBadgeClass(
            template.riskLevel
          )}`}
        >
          {getRiskLabel(template.riskLevel)}
        </span>
      </div>

      {!validation.ok || !encodedAction ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {validation.ok ? "提案动作暂时无法编码。" : validation.error}
        </div>
      ) : (
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              摘要
            </div>
            <div className="mt-1">{encodedAction.description}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                函数
              </div>
              <div className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">
                {template.functionName}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                调用值
              </div>
              <div className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">
                {encodedAction.value.toString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function ProposalList({
  proposals,
  loading,
  currentBlock,
  nowTs,
}: {
  proposals: ProposalItem[];
  loading: boolean;
  currentBlock?: bigint;
  nowTs: number;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
        正在加载提案列表...
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
        暂无提案，请先创建第一条治理提案。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {proposals.map((proposal) => (
        <ProposalCard
          key={proposal.proposalId.toString()}
          proposal={proposal}
          currentBlock={currentBlock}
          nowTs={nowTs}
        />
      ))}
    </div>
  );
}

function ProposalCard({
  proposal,
  currentBlock,
  nowTs,
}: {
  proposal: ProposalItem;
  currentBlock?: bigint;
  nowTs: number;
}) {
  const { data: state, refetch: refetchState } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "state",
    args: [proposal.proposalId],
  });

  const { data: votes, refetch: refetchVotes } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalVotes",
    args: [proposal.proposalId],
  });

  const { data: proposalEta, refetch: refetchProposalEta } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalEta",
    args: [proposal.proposalId],
  });

  useEffect(() => {
    if (currentBlock === undefined) {
      return;
    }

    void Promise.all([refetchProposalEta(), refetchState(), refetchVotes()]);
  }, [currentBlock, refetchProposalEta, refetchState, refetchVotes]);

  const proposalState = asBigInt(state);
  const proposalEtaValue = asBigInt(proposalEta);
  const currentStateLabel = stateLabel(proposalState);
  const actionSummaries = useMemo(
    () => summarizeProposalActions(proposal),
    [proposal]
  );
  const countdown = useMemo(
    () =>
      getProposalStageCountdown(
        currentBlock,
        proposal.voteStart,
        proposal.voteEnd,
        proposalState,
        proposalEtaValue,
        BigInt(nowTs)
      ),
    [currentBlock, nowTs, proposal.voteEnd, proposal.voteStart, proposalEtaValue, proposalState]
  );

  const voteData: ProposalVotes =
    asProposalVotes(votes) ?? {
      againstVotes: 0n,
      forVotes: 0n,
      abstainVotes: 0n,
    };

  const totalVotes =
    voteData.forVotes + voteData.againstVotes + voteData.abstainVotes;
  const forPercent =
    totalVotes > 0n ? Number((voteData.forVotes * 100n) / totalVotes) : 0;
  const againstPercent =
    totalVotes > 0n ? Number((voteData.againstVotes * 100n) / totalVotes) : 0;
  const abstainPercent =
    totalVotes > 0n ? Number((voteData.abstainVotes * 100n) / totalVotes) : 0;

  const canVote = Number(proposalState ?? -1) === 1;
  const canQueue = Number(proposalState ?? -1) === 4;
  const canExecute =
    Number(proposalState ?? -1) === 5 &&
    proposalEtaValue !== undefined &&
    proposalEtaValue > 0n &&
    BigInt(nowTs) >= proposalEtaValue;
  const availableActions = [
    canVote ? "投票" : null,
    canQueue ? "排队" : null,
    canExecute ? "执行" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                提案 #{proposal.proposalId.toString()}
              </span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${stateBadgeClass(
                  proposalState
                )}`}
              >
                {currentStateLabel}
              </span>
            </div>

            <Link
              href={`/governance/${proposal.proposalId.toString()}`}
              className="line-clamp-2 text-sm font-semibold text-slate-950 transition hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300"
            >
              {proposal.description || "无描述提案"}
            </Link>
          </div>

          <Link
            href={`/governance/${proposal.proposalId.toString()}`}
            className="shrink-0 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-100"
          >
            查看详情
          </Link>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>发起人: {shortenAddress(proposal.proposer)}</span>
          <span>创建区块: {proposal.blockNumber.toString()}</span>
          <span>投票区间: {formatBlockRange(proposal.voteStart, proposal.voteEnd)}</span>
          <span>
            {countdown.label}: {countdown.value}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
          {actionSummaries.length > 0 ? (
            <div className="space-y-1">
              <div className="font-medium text-slate-800 dark:text-slate-100">
                {actionSummaries[0]?.title}
              </div>
              <div className="line-clamp-2">
                {actionSummaries[0]?.description}
                {actionSummaries.length > 1
                  ? ` 另有 ${actionSummaries.length - 1} 个动作，进入详情查看。`
                  : ""}
              </div>
            </div>
          ) : (
            <div>暂无可解析的动作摘要，请进入详情页查看完整 calldata。</div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <VoteStat
            label="赞成"
            value={voteData.forVotes}
            percent={forPercent}
            color="bg-emerald-500"
          />
          <VoteStat
            label="反对"
            value={voteData.againstVotes}
            percent={againstPercent}
            color="bg-rose-500"
          />
          <VoteStat
            label="弃权"
            value={voteData.abstainVotes}
            percent={abstainPercent}
            color="bg-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>
            可在详情页操作:
            {" "}
            {availableActions.length > 0 ? availableActions.join(" / ") : "当前无可执行操作"}
          </span>
          <span>{proposal.targets.length} 个链上动作</span>
        </div>
      </div>
    </div>
  );
}

function VoteStat({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: bigint;
  percent?: number;
  color?: string;
}) {
  const formattedValue = value === 0n ? "0" : formatEther(value);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          {percent}%
        </div>
      </div>
      <div
        className="text-sm font-semibold text-slate-950 dark:text-slate-100"
        title={value.toString()}
      >
        {formattedValue}
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full ${color} transition-all duration-500 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
