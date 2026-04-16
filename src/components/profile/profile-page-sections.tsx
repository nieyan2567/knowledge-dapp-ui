"use client";

/**
 * 模块说明：个人中心分区组件集合，负责渲染个人摘要卡片、内容区、提案区和断连提示等区块。
 */
import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import { CheckCircle2, ExternalLink, FileText, Gavel, RefreshCw } from "lucide-react";
import { useReadContract } from "wagmi";

import { SectionCard } from "@/components/section-card";
import { ABIS, CONTRACTS } from "@/contracts";
import {
  formatProposalBlockRange,
  governanceStateBadgeClass,
  governanceStateLabel,
  summarizeProposalActions,
} from "@/lib/governance";
import { getIpfsFileUrl } from "@/lib/ipfs";
import {
  CONTENT_FILTER_OPTIONS,
  CONTENT_SORT_OPTIONS,
  formatContentsDescription,
  formatMoreActions,
  formatProfileDate,
  PROFILE_PAGE_COPY,
  shortenAddress,
  shortenCid,
  shortenProposalId,
  type ContentFilter,
  type ContentSort,
} from "@/lib/profile-page-helpers";
import { asBigInt } from "@/lib/web3-types";
import type { ContentData } from "@/types/content";
import type { ProposalItem } from "@/types/governance";

/**
 * 渲染个人中心摘要卡片。
 * @param icon 摘要图标。
 * @param label 摘要标题。
 * @param value 摘要值。
 * @param description 摘要说明。
 * @returns 个人摘要卡片。
 */
export function ProfileSummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  description: string;
}) {
  return (
    <div className="flex h-24 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
        <div className="text-slate-400 dark:text-slate-500">{icon}</div>
      </div>
      <div className="mt-2 text-lg font-semibold leading-tight text-slate-950 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-auto line-clamp-1 pt-1 text-xs text-slate-500 dark:text-slate-400">
        {description}
      </div>
    </div>
  );
}

/**
 * 渲染个人中心筛选按钮。
 * @param active 当前按钮是否处于激活状态。
 * @param onClick 点击回调。
 * @param children 按钮显示内容。
 * @returns 可复用的筛选按钮。
 */
export function ProfileFilterButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
          : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * 渲染个人中心区块内联错误状态。
 * @param message 错误信息。
 * @param retryLabel 重试按钮文案。
 * @param onRetry 重试回调。
 * @returns 内联错误提示组件。
 */
export function ProfileInlineErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 font-medium transition hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/30"
      >
        <RefreshCw className="h-4 w-4" />
        {retryLabel}
      </button>
    </div>
  );
}

/**
 * 渲染个人中心的居中空状态或加载状态。
 * @param children 需要展示的提示内容。
 * @returns 居中状态容器。
 */
export function ProfileCenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
      {children}
    </div>
  );
}

/**
 * 渲染个人内容分区。
 * @param myContents 当前用户全部内容数组。
 * @param visibleContents 当前筛选后的可见内容数组。
 * @param contentFilter 当前筛选项。
 * @param contentSort 当前排序项。
 * @param loadingContents 是否正在加载内容。
 * @param contentError 当前内容区错误信息。
 * @param onFilterChange 筛选切换回调。
 * @param onSortChange 排序切换回调。
 * @param onRefresh 重载内容回调。
 * @returns 个人内容区块。
 */
export function ProfileContentSection({
  myContents,
  visibleContents,
  contentFilter,
  contentSort,
  loadingContents,
  contentError,
  onFilterChange,
  onSortChange,
  onRefresh,
}: {
  myContents: ContentData[];
  visibleContents: ContentData[];
  contentFilter: ContentFilter;
  contentSort: ContentSort;
  loadingContents: boolean;
  contentError: string | null;
  onFilterChange: (value: ContentFilter) => void;
  onSortChange: (value: ContentSort) => void;
  onRefresh: () => void;
}) {
  return (
    <SectionCard
      title={PROFILE_PAGE_COPY.myContentsTitle}
      description={formatContentsDescription(myContents.length)}
      className="h-168"
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {CONTENT_FILTER_OPTIONS.map((option) => (
            <ProfileFilterButton
              key={option.value}
              active={contentFilter === option.value}
              onClick={() => onFilterChange(option.value)}
            >
              {option.label}
            </ProfileFilterButton>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span className="shrink-0">{PROFILE_PAGE_COPY.sortLabel}</span>
          <select
            value={contentSort}
            onChange={(event) => onSortChange(event.target.value as ContentSort)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-400"
          >
            {CONTENT_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {contentError ? (
        <ProfileInlineErrorState
          message={contentError}
          retryLabel={PROFILE_PAGE_COPY.reloadContents}
          onRetry={onRefresh}
        />
      ) : null}

      {loadingContents && myContents.length === 0 ? (
        <ProfileCenteredState>{PROFILE_PAGE_COPY.loadingContents}</ProfileCenteredState>
      ) : visibleContents.length === 0 ? (
        <ProfileCenteredState>
          {myContents.length === 0
            ? PROFILE_PAGE_COPY.noContents
            : PROFILE_PAGE_COPY.noFilteredContents}
        </ProfileCenteredState>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {visibleContents.map((item) => (
            <article
              key={item.id.toString()}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700 dark:hover:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{PROFILE_PAGE_COPY.contentIdPrefix}{item.id.toString()}</span>
                    <span>·</span>
                    <span>{PROFILE_PAGE_COPY.versionPrefix}{item.latestVersion.toString()}</span>
                  </div>
                  <Link
                    href={`/content/${item.id.toString()}`}
                    className="mt-2 block truncate text-lg font-semibold text-slate-950 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300"
                  >
                    {item.title}
                  </Link>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    item.deleted
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  }`}
                >
                  {item.deleted
                    ? PROFILE_PAGE_COPY.statusDeleted
                    : PROFILE_PAGE_COPY.statusActive}
                </span>
              </div>

              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {item.description || PROFILE_PAGE_COPY.noDescription}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {PROFILE_PAGE_COPY.updatedAt}
                  </div>
                  <div className="mt-1">{formatProfileDate(item.lastUpdatedAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {PROFILE_PAGE_COPY.voteCount}
                  </div>
                  <div className="mt-1">{item.voteCount.toString()}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <div className="font-medium text-slate-700 dark:text-slate-200">
                  {PROFILE_PAGE_COPY.currentCidLabel}
                </div>
                <div className="mt-1 break-all">{shortenCid(item.ipfsHash)}</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/content/${item.id.toString()}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <FileText className="h-4 w-4" />
                  {PROFILE_PAGE_COPY.viewDetail}
                </Link>
                <a
                  href={getIpfsFileUrl(item.ipfsHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  {PROFILE_PAGE_COPY.openFile}
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/**
 * 渲染个人提案分区。
 * @param proposals 当前用户提案数组。
 * @param loadingProposals 是否正在加载提案。
 * @param proposalError 当前提案区错误信息。
 * @param onRefresh 重载提案回调。
 * @returns 个人提案区块。
 */
export function ProfileProposalSection({
  myProposals,
  loadingProposals,
  proposalError,
  onRefresh,
}: {
  myProposals: ProposalItem[];
  loadingProposals: boolean;
  proposalError: string | null;
  onRefresh: () => void;
}) {
  return (
    <SectionCard
      title={PROFILE_PAGE_COPY.myProposalsTitle}
      description={PROFILE_PAGE_COPY.myProposalsDescription.replace(
        "{count}",
        String(myProposals.length)
      )}
      className="h-168"
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {PROFILE_PAGE_COPY.recentFirst}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" />
          {PROFILE_PAGE_COPY.reloadProposals}
        </button>
      </div>

      {proposalError ? (
        <ProfileInlineErrorState
          message={proposalError}
          retryLabel={PROFILE_PAGE_COPY.reloadProposals}
          onRetry={onRefresh}
        />
      ) : null}

      {loadingProposals && myProposals.length === 0 ? (
        <ProfileCenteredState>{PROFILE_PAGE_COPY.loadingProposals}</ProfileCenteredState>
      ) : myProposals.length === 0 ? (
        <ProfileCenteredState>{PROFILE_PAGE_COPY.noProposals}</ProfileCenteredState>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {myProposals.map((proposal) => (
            <ProfileProposalCard
              key={proposal.proposalId.toString()}
              proposal={proposal}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/**
 * 渲染单个个人提案卡片。
 * @param proposal 需要展示的提案数据。
 * @returns 提案摘要卡片。
 */
function ProfileProposalCard({ proposal }: { proposal: ProposalItem }) {
  const { data: state } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "state",
    args: [proposal.proposalId],
  });

  const proposalState = asBigInt(state);
  const actionSummaries = useMemo(() => summarizeProposalActions(proposal), [proposal]);

  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700 dark:hover:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div
            title={`${PROFILE_PAGE_COPY.proposalIdPrefix}${proposal.proposalId.toString()}`}
            className="text-xs text-slate-500 dark:text-slate-400"
          >
            {PROFILE_PAGE_COPY.proposalIdPrefix}
            {shortenProposalId(proposal.proposalId)}
          </div>
          <Link
            href={`/governance/${proposal.proposalId.toString()}`}
            className="mt-2 block truncate text-lg font-semibold text-slate-950 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300"
          >
            {proposal.description || PROFILE_PAGE_COPY.noProposalDescription}
          </Link>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${governanceStateBadgeClass(
            proposalState
          )}`}
        >
          {governanceStateLabel(proposalState)}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
          <Gavel className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          {PROFILE_PAGE_COPY.proposalActionsTitle}
        </div>
        {actionSummaries.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {PROFILE_PAGE_COPY.noActionSummary}
          </div>
        ) : (
          <div className="space-y-2">
            {actionSummaries.slice(0, 2).map((action, index) => (
              <div key={`${action.functionName}-${index}`}>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {action.title}
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {action.description}
                </div>
              </div>
            ))}
            {actionSummaries.length > 2 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {formatMoreActions(actionSummaries.length - 2)}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-3 dark:text-slate-300">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {PROFILE_PAGE_COPY.createdBlock}
          </div>
          <div className="mt-1">{proposal.blockNumber.toString()}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {PROFILE_PAGE_COPY.voteRange}
          </div>
          <div className="mt-1">
            {formatProposalBlockRange(proposal.voteStart, proposal.voteEnd)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {PROFILE_PAGE_COPY.actionCount}
          </div>
          <div className="mt-1">{proposal.targets.length}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/governance/${proposal.proposalId.toString()}`}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          <CheckCircle2 className="h-4 w-4" />
          {PROFILE_PAGE_COPY.viewProposal}
        </Link>
      </div>
    </article>
  );
}

/**
 * 渲染未连接钱包时的个人中心占位态。
 * @returns 未连接钱包提示组件。
 */
export function ProfileDisconnectedState() {
  return (
    <SectionCard
      title={PROFILE_PAGE_COPY.connectTitle}
      description={PROFILE_PAGE_COPY.connectDescription}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
        <span>{PROFILE_PAGE_COPY.connectHint}</span>
      </div>
    </SectionCard>
  );
}

/**
 * 缩写个人中心摘要中的地址。
 * @param address 需要展示的地址。
 * @returns 截断后的地址摘要文本。
 */
export function formatAddressSummaryValue(address: string) {
  return (
    <span title={address} className="block truncate text-sm font-medium text-slate-950 dark:text-slate-100">
      {shortenAddress(address)}
    </span>
  );
}
