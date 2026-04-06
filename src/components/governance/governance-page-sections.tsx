"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo } from "react";
import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import { ABIS, CONTRACTS } from "@/contracts";
import {
  formatProposalBlockRange,
  getProposalStageCountdown,
  governanceStateBadgeClass as stateBadgeClass,
  governanceStateLabel as stateLabel,
  summarizeProposalActions,
} from "@/lib/governance";
import {
  GOVERNANCE_CATEGORY_LABELS,
  type GovernanceGroupedTemplates,
} from "@/lib/governance-page-helpers";
import {
  formatGovernanceTemplateTarget,
  getRiskBadgeClass,
  getRiskLabel,
} from "@/lib/governance-templates";
import { asBigInt, asProposalVotes } from "@/lib/web3-types";
import type {
  GovernanceDraftAction,
  GovernanceEncodedAction,
  GovernanceTemplateDefinition,
  GovernanceTemplateField,
  ProposalItem,
  ProposalVotes,
} from "@/types/governance";

export type DraftActionValidation = { ok: true } | { ok: false; error: string };

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBlockRange(start?: bigint, end?: bigint) {
  return formatProposalBlockRange(start, end);
}

export function GovernanceMetricCard({
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

export function DraftActionEditor({
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
  validation: DraftActionValidation;
  groupedTemplates: GovernanceGroupedTemplates;
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
              <optgroup key={category} label={GOVERNANCE_CATEGORY_LABELS[category]}>
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

export function DraftActionPreview({
  index,
  template,
  validation,
  encodedAction,
}: {
  index: number;
  template: GovernanceTemplateDefinition | null;
  validation: DraftActionValidation;
  encodedAction: GovernanceEncodedAction | null;
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

export function PreviewStat({
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

export function ProposalList({
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
