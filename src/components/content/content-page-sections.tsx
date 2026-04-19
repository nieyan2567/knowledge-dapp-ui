"use client";

/**
 * @file 内容广场分区组件集合。
 * @description 负责把内容列表区和内容发布区拆成可复用的展示单元。
 */
import { formatEther } from "viem";

import { ContentCard } from "@/components/content-card";
import { CopyField } from "@/components/copy-field";
import { FileDrop } from "@/components/file-drop";
import { SectionCard } from "@/components/section-card";
import { BRANDING } from "@/lib/branding";
import {
  CONTENT_PAGE_COPY,
  formatContentCountSummary,
  formatContentPaginationSummary,
  formatUploadPolicyDescription,
} from "@/lib/content-page-helpers";
import type { ContentCardData } from "@/types/content";

/**
 * @notice 渲染内容列表分区。
 * @param search 当前搜索关键字。
 * @param scope 当前筛选范围。
 * @param sortBy 当前排序方式。
 * @param page 当前页码。
 * @param totalPages 总页数。
 * @param loadingList 是否正在加载列表。
 * @param sortedContentsLength 当前筛选后列表总数。
 * @param pagedContents 当前页内容数组。
 * @param onSearchChange 搜索词变更回调。
 * @param onScopeChange 范围切换回调。
 * @param onSortChange 排序切换回调。
 * @param onPrevPage 切换上一页回调。
 * @param onNextPage 切换下一页回调。
 * @param onActionComplete 卡片内链上操作完成后的刷新回调。
 * @returns 内容列表与筛选分页区块。
 */
export function ContentListSection({
  search,
  scope,
  sortBy,
  page,
  totalPages,
  loadingList,
  sortedContentsLength,
  pagedContents,
  onSearchChange,
  onScopeChange,
  onSortChange,
  onPrevPage,
  onNextPage,
  onActionComplete,
}: {
  search: string;
  scope: "all" | "mine";
  sortBy: "updated_desc" | "created_desc" | "votes_desc" | "versions_desc";
  page: number;
  totalPages: number;
  loadingList: boolean;
  sortedContentsLength: number;
  pagedContents: ContentCardData[];
  onSearchChange: (value: string) => void;
  onScopeChange: (value: "all" | "mine") => void;
  onSortChange: (value: "updated_desc" | "created_desc" | "votes_desc" | "versions_desc") => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onActionComplete: () => Promise<void>;
}) {
  return (
    <div className="space-y-4 lg:col-span-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
          {CONTENT_PAGE_COPY.listTitle}
        </h2>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {formatContentCountSummary(sortedContentsLength)}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
        <input
          placeholder={CONTENT_PAGE_COPY.searchPlaceholder}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <select
          value={scope}
          onChange={(event) => onScopeChange(event.target.value as "all" | "mine")}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400"
        >
          <option value="all">{CONTENT_PAGE_COPY.scopeAll}</option>
          <option value="mine">{CONTENT_PAGE_COPY.scopeMine}</option>
        </select>

        <select
          value={sortBy}
          onChange={(event) =>
            onSortChange(event.target.value as "updated_desc" | "created_desc" | "votes_desc" | "versions_desc")
          }
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400"
        >
          <option value="updated_desc">{CONTENT_PAGE_COPY.sortUpdated}</option>
          <option value="created_desc">{CONTENT_PAGE_COPY.sortCreated}</option>
          <option value="votes_desc">{CONTENT_PAGE_COPY.sortVotes}</option>
          <option value="versions_desc">{CONTENT_PAGE_COPY.sortVersions}</option>
        </select>
      </div>

      {loadingList ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          {CONTENT_PAGE_COPY.loadingList}
        </div>
      ) : sortedContentsLength === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {CONTENT_PAGE_COPY.emptyList}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {pagedContents.map((item) => (
              <ContentCard
                key={item.id.toString()}
                content={item}
                onActionComplete={onActionComplete}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <div>{formatContentPaginationSummary(page, totalPages, 8)}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrevPage}
                disabled={page <= 1}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {CONTENT_PAGE_COPY.prevPage}
              </button>
              <button
                type="button"
                onClick={onNextPage}
                disabled={page >= totalPages}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {CONTENT_PAGE_COPY.nextPage}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @notice 渲染内容上传与链上登记分区。
 * @param title 待发布内容标题。
 * @param desc 待发布内容描述。
 * @param file 当前选中的文件。
 * @param lastPublishedCid 最近一次成功上传的 CID。
 * @param lastPublishedUrl 最近一次成功上传的网关地址。
 * @param uploading 是否正在上传文件。
 * @param registering 是否正在登记上链。
 * @param isAuthenticating 是否正在进行上传鉴权。
 * @param registerFee 当前内容登记费用。
 * @param uploadMaxFileSizeText 上传大小限制文本。
 * @param onTitleChange 标题变更回调。
 * @param onDescriptionChange 描述变更回调。
 * @param onFileChange 文件变更回调。
 * @param onPublish 发布触发回调。
 * @returns 内容发布区块。
 */
export function ContentUploadSection({
  title,
  desc,
  file,
  lastPublishedCid,
  lastPublishedUrl,
  uploading,
  registering,
  isAuthenticating,
  registerFee,
  uploadMaxFileSizeText,
  onTitleChange,
  onDescriptionChange,
  onFileChange,
  onPublish,
}: {
  title: string;
  desc: string;
  file: File | null;
  lastPublishedCid: string;
  lastPublishedUrl: string;
  uploading: boolean;
  registering: boolean;
  isAuthenticating: boolean;
  registerFee?: bigint;
  uploadMaxFileSizeText: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFileChange: (file: File) => void;
  onPublish: () => void;
}) {
  const publishLabel = isAuthenticating
    ? CONTENT_PAGE_COPY.authenticating
    : uploading
      ? CONTENT_PAGE_COPY.uploading
      : registering
        ? CONTENT_PAGE_COPY.registering
        : CONTENT_PAGE_COPY.uploadAndRegister;

  return (
    <div>
      <SectionCard
        title={CONTENT_PAGE_COPY.uploadTitle}
        description={CONTENT_PAGE_COPY.uploadDescription}
      >
        <div className="space-y-4">
          <input
            placeholder={CONTENT_PAGE_COPY.titlePlaceholder}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
          />

          <textarea
            placeholder={CONTENT_PAGE_COPY.descriptionPlaceholder}
            value={desc}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
          />

          <FileDrop file={file} onChange={onFileChange} />

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            {formatUploadPolicyDescription(uploadMaxFileSizeText)}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <div className="font-medium text-slate-900 dark:text-slate-100">
              {CONTENT_PAGE_COPY.registerFeeTitle}
            </div>
            <div className="mt-1">
              {typeof registerFee === "bigint"
                ? registerFee > 0n
                  ? `${formatEther(registerFee)} ${BRANDING.nativeTokenSymbol}`
                  : CONTENT_PAGE_COPY.freeNow
                : CONTENT_PAGE_COPY.loadingFee}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {CONTENT_PAGE_COPY.registerFeeDescription}
            </div>
          </div>

          <button
            type="button"
            onClick={onPublish}
            disabled={!file || uploading || registering || isAuthenticating}
            className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {publishLabel}
          </button>

          {lastPublishedCid && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {CONTENT_PAGE_COPY.lastPublishResult}
              </div>
              <CopyField label="CID" value={lastPublishedCid} />
              <CopyField
                label={CONTENT_PAGE_COPY.localGatewayUrl}
                value={lastPublishedUrl}
              />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
