"use client";

import Link from "next/link";
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
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gavel,
  Plus,
  RefreshCw,
  Trash2,
  Vote,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
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
  treasury: "Treasury",
  governor: "Governor",
  timelock: "Timelock",
};

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
    case "treasury":
      return 1;
    case "governor":
      return 2;
    case "timelock":
      return 3;
    default:
      return 999;
  }
}

export default function GovernancePage() {
  const { address } = useAccount();
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
  const hasHighRiskAction = encodedActions.some(
    (action) => action.riskLevel === "high"
  );
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

      const logs = await publicClient.getLogs({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        event: proposalCreatedEvent,
        fromBlock: 0n,
        toBlock: latestBlock,
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
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Governor / Timelock / DAO"
        title="Governance Center"
        description="创建模板化治理提案，组合多个链上动作，并在同一页面查看提案状态、投票、排队和执行。"
        right={
          <div className="flex items-center gap-3">
            <button
              onClick={loadProposals}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>

            <a
              href={explorerAddressUrl(CONTRACTS.KnowledgeGovernor)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              查看合约
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              提案门槛
            </div>
            <Gavel className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
            {proposalThreshold
              ? `${formatEther(proposalThreshold as bigint)} ${BRANDING.nativeTokenSymbol}`
              : "-"}
          </div>
          <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            创建提案所需的最低投票权。
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              投票延迟
            </div>
            <Clock3 className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
            {votingDelay ? String(votingDelay) : "-"}
          </div>
          <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            提案创建后到投票开始前的等待区块数。
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              投票周期
            </div>
            <Vote className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
            {votingPeriod ? String(votingPeriod) : "-"}
          </div>
          <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            提案处于可投票状态的持续区块数。
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <SectionCard
          title="创建提案"
          description="从白名单模板中组合多个治理动作，再统一发起同一份提案。"
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                提案描述
              </div>
              <textarea
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="描述这份治理提案的目标和影响"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
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

            {draftStates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                当前没有提案动作，请先添加一个治理动作。
              </div>
            ) : (
              <div className="space-y-4">
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

            {hasHighRiskAction ? (
              <label className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                  checked={highRiskConfirmed}
                  onChange={(event) => setHighRiskConfirmed(event.target.checked)}
                />
                <span>
                  该提案包含高风险治理动作，可能影响系统可用性或核心治理参数。我已经核对目标合约、参数和预期影响。
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
          description="最终会把这些动作按顺序编码为 Governor.propose 的 targets、values 和 calldatas。"
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <PreviewStat
                label="动作数量"
                value={String(draftActions.length)}
              />
              <PreviewStat
                label="有效动作"
                value={String(encodedActions.length)}
              />
              <PreviewStat
                label="高风险动作"
                value={String(
                  encodedActions.filter((action) => action.riskLevel === "high").length
                )}
              />
            </div>

            {!trimmedDescription ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                请输入提案描述，预览区才算完整。
              </div>
            ) : null}

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
        </SectionCard>
      </section>

      <SectionCard
        title="提案列表"
        description="查看当前提案状态、动作摘要和投票情况。"
      >
        <ProposalList
          proposals={proposals}
          loading={loadingProposals}
          onActionComplete={loadProposals}
        />
      </SectionCard>
    </main>
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
            该模板没有额外参数，提交时会直接编码对应函数调用。
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
        动作 #{index + 1} 尚未选择模板。
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
                Function
              </div>
              <div className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">
                {template.functionName}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Value
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
  onActionComplete,
}: {
  proposals: ProposalItem[];
  loading: boolean;
  onActionComplete: () => unknown | Promise<unknown>;
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
          onActionComplete={onActionComplete}
        />
      ))}
    </div>
  );
}

function ProposalCard({
  proposal,
  onActionComplete,
}: {
  proposal: ProposalItem;
  onActionComplete: () => unknown | Promise<unknown>;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { writeContractAsync } = useWriteContract();
  const refreshAfterTx = useRefreshOnTxConfirmed();

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

  const proposalState = asBigInt(state);
  const currentStateLabel = stateLabel(proposalState);
  const actionSummaries = useMemo(
    () => summarizeProposalActions(proposal),
    [proposal]
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
  const canExecute = Number(proposalState ?? -1) === 5;

  useEffect(() => {
    if (blockNumber === undefined) {
      return;
    }

    void Promise.all([refetchState(), refetchVotes()]);
  }, [blockNumber, refetchState, refetchVotes]);

  async function refreshProposalCard() {
    await Promise.all([refetchState(), refetchVotes(), onActionComplete()]);
  }

  async function handleVote(support: 0 | 1 | 2) {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    let actionText = "赞成";
    if (support === 0) actionText = "反对";
    if (support === 2) actionText = "弃权";

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "castVote",
        args: [proposal.proposalId, support],
        account: address,
      },
      loading: `正在提交${actionText}投票...`,
      success: "投票交易已提交",
      fail: "投票失败",
    });

    if (!hash) return;

    await refreshAfterTx(hash, refreshProposalCard, ["governance", "system"]);
  }

  async function handleQueue() {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "queue",
        args: [
          proposal.targets,
          proposal.values,
          proposal.calldatas,
          proposal.descriptionHash,
        ],
        account: address,
      },
      loading: "正在提交排队交易...",
      success: "排队交易已提交",
      fail: "排队失败",
    });

    if (!hash) return;

    await refreshAfterTx(hash, refreshProposalCard, ["governance", "system"]);
  }

  async function handleExecute() {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        abi: ABIS.KnowledgeGovernor,
        functionName: "execute",
        args: [
          proposal.targets,
          proposal.values,
          proposal.calldatas,
          proposal.descriptionHash,
        ],
        account: address,
      },
      loading: "正在提交执行交易...",
      success: "执行交易已提交",
      fail: "执行失败",
    });

    if (!hash) return;

    await refreshAfterTx(hash, refreshProposalCard, ["governance", "system"]);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-4">
        <div className="min-w-0">
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
            className="text-base font-semibold text-slate-950 dark:text-slate-100"
          >
            {proposal.description || "无描述"}
          </Link>

          {actionSummaries.length > 0 ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                提案内容
              </div>
              <div className="mt-1.5 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                {actionSummaries.slice(0, 2).map((action, index) => (
                  <div key={`${action.functionName}-${index}`}>
                    <div className="font-medium">{action.title}</div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {action.description}
                    </div>
                  </div>
                ))}
                {actionSummaries.length > 2 ? (
                  <div className="text-slate-500 dark:text-slate-400">
                    另有 {actionSummaries.length - 2} 个提案动作，请进入详情查看。
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>发起人: {shortenAddress(proposal.proposer)}</span>
            <span>创建区块: {proposal.blockNumber.toString()}</span>
            <span>
              投票区间: {formatBlockRange(proposal.voteStart, proposal.voteEnd)}
            </span>
          </div>

          <div className="mt-3 space-y-2">
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
        </div>

        <div className="grid gap-2 border-t border-slate-200 pt-3 dark:border-slate-800 sm:grid-cols-2 xl:grid-cols-5">
          <button
            onClick={() => handleVote(1)}
            disabled={!canVote}
            className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            投赞成票
          </button>

          <button
            onClick={() => handleVote(0)}
            disabled={!canVote}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            投反对票
          </button>

          <button
            onClick={() => handleVote(2)}
            disabled={!canVote}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            弃权
          </button>

          <button
            onClick={handleQueue}
            disabled={!canQueue}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            加入队列
          </button>

          <button
            onClick={handleExecute}
            disabled={!canExecute}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            <CheckCircle2 className="h-4 w-4" />
            执行
          </button>
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
