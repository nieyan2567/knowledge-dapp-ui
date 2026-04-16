/**
 * 模块说明：治理页面布局组件，负责组织治理主页面的流程区、列表区、创建器、预览区和侧边栏。
 */
"use client";
import { formatEther } from "viem";
import {
  ArrowRight,
  Clock3,
  Coins,
  ExternalLink,
  Gavel,
  Plus,
  Vote,
} from "lucide-react";

import {
  DraftActionEditor,
  DraftActionPreview,
  GovernanceMetricCard,
  PreviewStat,
  ProposalList,
} from "@/components/governance/governance-page-sections";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { CONTRACTS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import {
  GOVERNANCE_FLOW_STEPS,
  GOVERNANCE_PAGE_COPY,
  type GovernanceGroupedTemplates,
  MAX_GOVERNANCE_DRAFT_ACTIONS,
} from "@/lib/governance-page-helpers";
import { PAGE_TEST_IDS } from "@/lib/test-ids";
import type {
  GovernanceDraftAction,
  GovernanceEncodedAction,
  GovernanceTemplateDefinition,
  ProposalItem,
} from "@/types/governance";

type DraftActionValidation = { ok: true } | { ok: false; error: string };

/**
 * 表示治理页面中单个草稿动作的完整派生状态。
 */
export type GovernanceDraftState = {
  action: GovernanceDraftAction;
  template: GovernanceTemplateDefinition | null;
  validation: DraftActionValidation;
  encodedAction: GovernanceEncodedAction | null;
};

/**
 * 构造 Governor 合约地址的区块浏览器链接。
 * @param address 需要展示的合约地址。
 * @returns 指向浏览器地址详情页的链接。
 */
function explorerAddressUrl(address: string) {
  return `${BRANDING.explorerUrl}/address/${address}`;
}

/**
 * 渲染治理页面整体布局。
 * @param props 治理页面所需的全部布局数据与交互回调。
 * @returns 完整治理页面布局。
 */
export function GovernancePageLayout(props: {
  description: string;
  proposalFee?: bigint;
  proposalThreshold?: bigint;
  votingDelay?: bigint;
  votingPeriod?: bigint;
  activeGovernanceStep: number;
  currentGovernanceStageText: string;
  loadingProposals: boolean;
  proposals: ProposalItem[];
  liveBlockNumber?: bigint;
  nowTs: number;
  draftActions: GovernanceDraftAction[];
  draftStates: GovernanceDraftState[];
  groupedTemplates: GovernanceGroupedTemplates;
  highRiskActionCount: number;
  hasHighRiskAction: boolean;
  highRiskConfirmed: boolean;
  canSubmitProposal: boolean;
  onDescriptionChange: (value: string) => void;
  onAddAction: () => void;
  onTemplateChange: (actionId: string, templateId: string) => void;
  onFieldChange: (actionId: string, key: string, value: string | boolean) => void;
  onMoveAction: (actionId: string, direction: "up" | "down") => void;
  onRemoveAction: (actionId: string) => void;
  onHighRiskConfirmedChange: (checked: boolean) => void;
  onPropose: () => void;
}) {
  const {
    description,
    proposalFee,
    proposalThreshold,
    votingDelay,
    votingPeriod,
    activeGovernanceStep,
    currentGovernanceStageText,
    loadingProposals,
    proposals,
    liveBlockNumber,
    nowTs,
    draftActions,
    draftStates,
    groupedTemplates,
    highRiskActionCount,
    hasHighRiskAction,
    highRiskConfirmed,
    canSubmitProposal,
    onDescriptionChange,
    onAddAction,
    onTemplateChange,
    onFieldChange,
    onMoveAction,
    onRemoveAction,
    onHighRiskConfirmedChange,
    onPropose,
  } = props;

  const trimmedDescription = description.trim();
  const encodedActions = draftStates.flatMap((state) =>
    state.encodedAction ? [state.encodedAction] : []
  );

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
            {GOVERNANCE_PAGE_COPY.viewGovernorContract}
            <ExternalLink className="h-4 w-4" />
          </a>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_320px] xl:items-start">
        <div className="space-y-6">
          <GovernanceFlowSection
            activeGovernanceStep={activeGovernanceStep}
            currentGovernanceStageText={currentGovernanceStageText}
          />

          <GovernanceProposalListSection
            proposals={proposals}
            loadingProposals={loadingProposals}
            draftActionCount={draftActions.length}
            highRiskActionCount={highRiskActionCount}
            liveBlockNumber={liveBlockNumber}
            nowTs={nowTs}
          />

          <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.95fr)] 2xl:items-stretch">
            <GovernanceComposerSection
              description={description}
              draftStates={draftStates}
              draftActionCount={draftActions.length}
              groupedTemplates={groupedTemplates}
              hasHighRiskAction={hasHighRiskAction}
              highRiskConfirmed={highRiskConfirmed}
              proposalFee={proposalFee}
              canSubmitProposal={canSubmitProposal}
              onDescriptionChange={onDescriptionChange}
              onAddAction={onAddAction}
              onTemplateChange={onTemplateChange}
              onFieldChange={onFieldChange}
              onMoveAction={onMoveAction}
              onRemoveAction={onRemoveAction}
              onHighRiskConfirmedChange={onHighRiskConfirmedChange}
              onPropose={onPropose}
            />

            <GovernancePreviewSection
              trimmedDescription={trimmedDescription}
              draftStates={draftStates}
              draftActionCount={draftActions.length}
              encodedActionCount={encodedActions.length}
              highRiskActionCount={highRiskActionCount}
            />
          </section>
        </div>

        <GovernanceSidebarSection
          proposalThreshold={proposalThreshold}
          proposalFee={proposalFee}
          votingDelay={votingDelay}
          votingPeriod={votingPeriod}
        />
      </div>
    </main>
  );
}

/**
 * 渲染治理流程路径区。
 * @param activeGovernanceStep 当前所处治理步骤。
 * @param currentGovernanceStageText 当前阶段说明。
 * @returns 治理流程路径区块。
 */
function GovernanceFlowSection({
  activeGovernanceStep,
  currentGovernanceStageText,
}: {
  activeGovernanceStep: number;
  currentGovernanceStageText: string;
}) {
  return (
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
          <span>{GOVERNANCE_PAGE_COPY.currentStep}</span>
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
                      {GOVERNANCE_PAGE_COPY.formatters.stepLabel(step.step)}
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
                  {GOVERNANCE_PAGE_COPY.currentStage}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GovernanceProposalListSection({
  proposals,
  loadingProposals,
  draftActionCount,
  highRiskActionCount,
  liveBlockNumber,
  nowTs,
}: {
  proposals: Array<Parameters<typeof ProposalList>[0]["proposals"][number]>;
  loadingProposals: boolean;
  draftActionCount: number;
  highRiskActionCount: number;
  liveBlockNumber?: bigint;
  nowTs: number;
}) {
  return (
    <SectionCard
      title={GOVERNANCE_PAGE_COPY.listTitle}
      description={GOVERNANCE_PAGE_COPY.listDescription}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <PreviewStat
          label={GOVERNANCE_PAGE_COPY.metrics.currentProposals}
          value={String(proposals.length)}
        />
        <PreviewStat
          label={GOVERNANCE_PAGE_COPY.metrics.configuredActions}
          value={String(draftActionCount)}
        />
        <PreviewStat
          label={GOVERNANCE_PAGE_COPY.metrics.highRiskActions}
          value={String(highRiskActionCount)}
        />
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
  );
}

function GovernanceComposerSection({
  description,
  draftStates,
  draftActionCount,
  groupedTemplates,
  hasHighRiskAction,
  highRiskConfirmed,
  proposalFee,
  canSubmitProposal,
  onDescriptionChange,
  onAddAction,
  onTemplateChange,
  onFieldChange,
  onMoveAction,
  onRemoveAction,
  onHighRiskConfirmedChange,
  onPropose,
}: {
  description: string;
  draftStates: GovernanceDraftState[];
  draftActionCount: number;
  groupedTemplates: GovernanceGroupedTemplates;
  hasHighRiskAction: boolean;
  highRiskConfirmed: boolean;
  proposalFee?: bigint;
  canSubmitProposal: boolean;
  onDescriptionChange: (value: string) => void;
  onAddAction: () => void;
  onTemplateChange: (actionId: string, templateId: string) => void;
  onFieldChange: (actionId: string, key: string, value: string | boolean) => void;
  onMoveAction: (actionId: string, direction: "up" | "down") => void;
  onRemoveAction: (actionId: string) => void;
  onHighRiskConfirmedChange: (checked: boolean) => void;
  onPropose: () => void;
}) {
  return (
    <SectionCard
      title={GOVERNANCE_PAGE_COPY.createTitle}
      description={GOVERNANCE_PAGE_COPY.createDescription}
      className="h-208"
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {GOVERNANCE_PAGE_COPY.proposalDescriptionLabel}
          </div>
          <textarea
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
            rows={2}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={GOVERNANCE_PAGE_COPY.proposalDescriptionPlaceholder}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {GOVERNANCE_PAGE_COPY.draftActionsLabel}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {GOVERNANCE_PAGE_COPY.formatters.actionCount(
                draftActionCount,
                MAX_GOVERNANCE_DRAFT_ACTIONS
              )}
            </div>
          </div>

          <button
            onClick={onAddAction}
            disabled={draftActionCount >= MAX_GOVERNANCE_DRAFT_ACTIONS}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            {GOVERNANCE_PAGE_COPY.addAction}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {draftStates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
              {GOVERNANCE_PAGE_COPY.noActions}
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
                  onTemplateChange={onTemplateChange}
                  onFieldChange={onFieldChange}
                  onMoveAction={onMoveAction}
                  onRemoveAction={onRemoveAction}
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
              onChange={(event) => onHighRiskConfirmedChange(event.target.checked)}
            />
            <span>{GOVERNANCE_PAGE_COPY.highRiskConfirmation}</span>
          </label>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
          <div className="font-medium text-slate-900 dark:text-slate-100">
            {GOVERNANCE_PAGE_COPY.proposalFeeLabel}
          </div>
          <div className="mt-1">
            {typeof proposalFee === "bigint"
              ? proposalFee > 0n
                ? `${formatEther(proposalFee)} ${BRANDING.nativeTokenSymbol}`
                : GOVERNANCE_PAGE_COPY.proposalFeeFree
              : GOVERNANCE_PAGE_COPY.proposalFeeLoading}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {GOVERNANCE_PAGE_COPY.proposalFeeHelp}
          </div>
        </div>

        <button
          data-testid="governance-propose-button"
          onClick={onPropose}
          disabled={!canSubmitProposal}
          className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
        >
          {GOVERNANCE_PAGE_COPY.submitProposal}
        </button>
      </div>
    </SectionCard>
  );
}

function GovernancePreviewSection({
  trimmedDescription,
  draftStates,
  draftActionCount,
  encodedActionCount,
  highRiskActionCount,
}: {
  trimmedDescription: string;
  draftStates: GovernanceDraftState[];
  draftActionCount: number;
  encodedActionCount: number;
  highRiskActionCount: number;
}) {
  return (
    <SectionCard
      title={GOVERNANCE_PAGE_COPY.previewTitle}
      description={GOVERNANCE_PAGE_COPY.previewDescription}
      className="h-208"
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <PreviewStat
            label={GOVERNANCE_PAGE_COPY.metrics.actionCount}
            value={String(draftActionCount)}
          />
          <PreviewStat
            label={GOVERNANCE_PAGE_COPY.metrics.validActions}
            value={String(encodedActionCount)}
          />
          <PreviewStat
            label={GOVERNANCE_PAGE_COPY.metrics.highRiskActions}
            value={String(highRiskActionCount)}
          />
        </div>

        {!trimmedDescription ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
            {GOVERNANCE_PAGE_COPY.previewDescriptionEmpty}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {GOVERNANCE_PAGE_COPY.previewDescriptionLabel}
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
  );
}

function GovernanceSidebarSection({
  proposalThreshold,
  proposalFee,
  votingDelay,
  votingPeriod,
}: {
  proposalThreshold?: bigint;
  proposalFee?: bigint;
  votingDelay?: bigint;
  votingPeriod?: bigint;
}) {
  return (
    <div className="space-y-6 xl:sticky xl:top-6">
      <SectionCard
        title={GOVERNANCE_PAGE_COPY.paramsTitle}
        description={GOVERNANCE_PAGE_COPY.paramsDescription}
      >
        <div className="space-y-3">
          <GovernanceMetricCard
            icon={<Gavel className="h-5 w-5 text-slate-500 dark:text-slate-400" />}
            label={GOVERNANCE_PAGE_COPY.params.proposalThreshold}
            value={
              proposalThreshold
                ? `${formatEther(proposalThreshold)} ${BRANDING.nativeTokenSymbol}`
                : "-"
            }
            description={GOVERNANCE_PAGE_COPY.params.proposalThresholdHelp}
          />

          <GovernanceMetricCard
            icon={<Coins className="h-5 w-5 text-slate-500 dark:text-slate-400" />}
            label={GOVERNANCE_PAGE_COPY.params.proposalFee}
            value={
              typeof proposalFee === "bigint"
                ? proposalFee > 0n
                  ? `${formatEther(proposalFee)} ${BRANDING.nativeTokenSymbol}`
                  : GOVERNANCE_PAGE_COPY.proposalFeeFree
                : "-"
            }
            description={GOVERNANCE_PAGE_COPY.params.proposalFeeHelp}
          />

          <GovernanceMetricCard
            icon={<Clock3 className="h-5 w-5 text-slate-500 dark:text-slate-400" />}
            label={GOVERNANCE_PAGE_COPY.params.votingDelay}
            value={votingDelay ? String(votingDelay) : "-"}
            description={GOVERNANCE_PAGE_COPY.params.votingDelayHelp}
          />

          <GovernanceMetricCard
            icon={<Vote className="h-5 w-5 text-slate-500 dark:text-slate-400" />}
            label={GOVERNANCE_PAGE_COPY.params.votingPeriod}
            value={votingPeriod ? String(votingPeriod) : "-"}
            description={GOVERNANCE_PAGE_COPY.params.votingPeriodHelp}
          />

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <div className="font-medium text-slate-900 dark:text-slate-100">
              {GOVERNANCE_PAGE_COPY.params.governorAddress}
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
              {GOVERNANCE_PAGE_COPY.params.openInExplorer}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
