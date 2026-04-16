"use client";

/**
 * 模块说明：内容详情侧边操作组件集合，负责渲染投票、奖励记账、恢复、编辑和删除相关表单。
 */
import { formatEther } from "viem";
import { Coins, Heart, PencilLine, RotateCcw, Trash2 } from "lucide-react";

import { CopyField } from "@/components/copy-field";
import { FileDrop } from "@/components/file-drop";
import { SectionCard } from "@/components/section-card";
import { BRANDING } from "@/lib/branding";
import {
  CONTENT_DETAIL_COPY,
  formatUploadVersionDescription,
} from "@/lib/content-detail-helpers";

/**
 * 渲染内容详情侧边的快捷操作区。
 * @param deleted 当前内容是否已删除。
 * @param isAuthor 当前用户是否为作者。
 * @param canRestoreContent 当前是否允许恢复内容。
 * @param restoring 是否正在恢复。
 * @param onVote 投票回调。
 * @param onAccrueReward 奖励记账回调。
 * @param onRestore 恢复回调。
 * @returns 侧边快捷操作区块。
 */
export function ContentActionsSection({
  deleted,
  isAuthor,
  canRestoreContent,
  restoring,
  onVote,
  onAccrueReward,
  onRestore,
}: {
  deleted: boolean;
  isAuthor: boolean;
  canRestoreContent: boolean;
  restoring: boolean;
  onVote: () => void;
  onAccrueReward: () => void;
  onRestore: () => void;
}) {
  return (
    <SectionCard
      title={CONTENT_DETAIL_COPY.actionsTitle}
      description={CONTENT_DETAIL_COPY.actionsDescription}
    >
      <div className="space-y-3">
        <button
          onClick={onVote}
          disabled={deleted}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Heart className="h-4 w-4" />
          {CONTENT_DETAIL_COPY.voteButton}
        </button>

        <button
          onClick={onAccrueReward}
          disabled={deleted || !isAuthor}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Coins className="h-4 w-4" />
          {CONTENT_DETAIL_COPY.accrueRewardButton}
        </button>

        {!isAuthor ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            {CONTENT_DETAIL_COPY.accrueRewardAuthorOnly}
          </div>
        ) : null}

        {canRestoreContent ? (
          <button
            onClick={onRestore}
            disabled={restoring}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 px-5 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            <RotateCcw className="h-4 w-4" />
            {restoring
              ? CONTENT_DETAIL_COPY.restoreLoading
              : CONTENT_DETAIL_COPY.restoreButton}
          </button>
        ) : null}
      </div>
    </SectionCard>
  );
}

/**
 * 渲染内容编辑与版本上传区。
 * @param editTitle 编辑中的标题。
 * @param editDescription 编辑中的描述。
 * @param editCid 编辑中的目标 CID。
 * @param versionFile 当前选中的新版本文件。
 * @param uploadedVersionUrl 新版本上传后的网关地址。
 * @param uploadingVersionFile 是否正在上传新版本文件。
 * @param savingEdit 是否正在保存编辑。
 * @param deleting 是否正在删除内容。
 * @param restoring 是否正在恢复内容。
 * @param isAuthenticating 是否正在进行上传鉴权。
 * @param updateFee 当前更新费用。
 * @param uploadMaxFileSizeText 版本文件上传限制说明。
 * @param newVersionBlockedReason 阻止提交新版本的原因。
 * @param canEditContent 当前是否允许编辑。
 * @param isAuthor 当前用户是否为作者。
 * @param canRestoreContent 当前是否允许恢复。
 * @param canDeleteContent 当前是否允许删除。
 * @param currentCid 当前内容 CID。
 * @param onEditTitleChange 标题变更回调。
 * @param onEditDescriptionChange 描述变更回调。
 * @param onEditCidChange CID 变更回调。
 * @param onVersionFileChange 版本文件变更回调。
 * @param onUploadVersionFile 上传新版本文件回调。
 * @param onUpdateContent 更新内容回调。
 * @param onDeleteContent 删除内容回调。
 * @param onRestoreContent 恢复内容回调。
 * @returns 内容编辑与版本上传区块。
 */
export function ContentEditSection({
  editTitle,
  editDescription,
  editCid,
  versionFile,
  uploadedVersionUrl,
  uploadingVersionFile,
  savingEdit,
  deleting,
  restoring,
  isAuthenticating,
  updateFee,
  uploadMaxFileSizeText,
  newVersionBlockedReason,
  canEditContent,
  isAuthor,
  canRestoreContent,
  canDeleteContent,
  currentCid,
  onEditTitleChange,
  onEditDescriptionChange,
  onEditCidChange,
  onVersionFileChange,
  onUploadVersionFile,
  onUpdateContent,
  onDeleteContent,
  onRestoreContent,
}: {
  editTitle: string;
  editDescription: string;
  editCid: string;
  versionFile: File | null;
  uploadedVersionUrl: string;
  uploadingVersionFile: boolean;
  savingEdit: boolean;
  deleting: boolean;
  restoring: boolean;
  isAuthenticating: boolean;
  updateFee?: bigint;
  uploadMaxFileSizeText: string;
  newVersionBlockedReason: string | null;
  canEditContent: boolean;
  isAuthor: boolean;
  canRestoreContent: boolean;
  canDeleteContent: boolean;
  currentCid: string;
  onEditTitleChange: (value: string) => void;
  onEditDescriptionChange: (value: string) => void;
  onEditCidChange: (value: string) => void;
  onVersionFileChange: (file: File) => void;
  onUploadVersionFile: () => void;
  onUpdateContent: () => void;
  onDeleteContent: () => void;
  onRestoreContent: () => void;
}) {
  return (
    <SectionCard
      title={CONTENT_DETAIL_COPY.editTitle}
      description={CONTENT_DETAIL_COPY.editDescription}
    >
      <div className="space-y-4">
        <input
          value={editTitle}
          onChange={(event) => onEditTitleChange(event.target.value)}
          disabled={!!newVersionBlockedReason || savingEdit || uploadingVersionFile}
          placeholder={CONTENT_DETAIL_COPY.titlePlaceholder}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
        />

        <textarea
          value={editDescription}
          onChange={(event) => onEditDescriptionChange(event.target.value)}
          disabled={!!newVersionBlockedReason || savingEdit || uploadingVersionFile}
          placeholder={CONTENT_DETAIL_COPY.descriptionPlaceholder}
          rows={4}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
        />

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
            {CONTENT_DETAIL_COPY.uploadVersionTitle}
          </div>
          <FileDrop file={versionFile} onChange={onVersionFileChange} />
          <div className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
            {formatUploadVersionDescription(uploadMaxFileSizeText)}
          </div>
          <button
            onClick={onUploadVersionFile}
            disabled={
              !!newVersionBlockedReason ||
              !versionFile ||
              savingEdit ||
              uploadingVersionFile ||
              isAuthenticating
            }
            className="mt-3 w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {isAuthenticating
              ? CONTENT_DETAIL_COPY.uploadVersionAuthenticating
              : uploadingVersionFile
                ? CONTENT_DETAIL_COPY.uploadVersionLoading
                : CONTENT_DETAIL_COPY.uploadVersionIdle}
          </button>
        </div>

        <input
          value={editCid}
          onChange={(event) => onEditCidChange(event.target.value)}
          disabled={!!newVersionBlockedReason || savingEdit || uploadingVersionFile}
          placeholder={CONTENT_DETAIL_COPY.newCidPlaceholder}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
        />

        <CopyField label={CONTENT_DETAIL_COPY.currentCidLabel} value={currentCid} />
        {uploadedVersionUrl ? (
          <CopyField
            label={CONTENT_DETAIL_COPY.newVersionGatewayUrlLabel}
            value={uploadedVersionUrl}
          />
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
          <div className="font-medium text-slate-900 dark:text-slate-100">
            {CONTENT_DETAIL_COPY.updateFeeTitle}
          </div>
          <div className="mt-1">
            {updateFee === undefined
              ? CONTENT_DETAIL_COPY.loadingFee
              : updateFee > 0n
                ? `${formatEther(updateFee)} ${BRANDING.nativeTokenSymbol}`
                : CONTENT_DETAIL_COPY.freeNow}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {CONTENT_DETAIL_COPY.updateFeeDescription}
          </div>
        </div>

        {newVersionBlockedReason ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            {newVersionBlockedReason}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
          {canEditContent
            ? CONTENT_DETAIL_COPY.editHintEditable
            : isAuthor
              ? CONTENT_DETAIL_COPY.editHintAuthorBlocked
              : CONTENT_DETAIL_COPY.editHintNonAuthor}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onUpdateContent}
            disabled={
              !!newVersionBlockedReason ||
              savingEdit ||
              uploadingVersionFile ||
              updateFee === undefined
            }
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <PencilLine className="h-4 w-4" />
            {savingEdit
              ? CONTENT_DETAIL_COPY.createVersionLoading
              : CONTENT_DETAIL_COPY.createVersionIdle}
          </button>

          <button
            onClick={canRestoreContent ? onRestoreContent : onDeleteContent}
            disabled={canRestoreContent ? restoring : !canDeleteContent || deleting}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              canRestoreContent
                ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                : "border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"
            }`}
          >
            {canRestoreContent ? (
              <RotateCcw className="h-4 w-4" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {canRestoreContent
              ? restoring
                ? CONTENT_DETAIL_COPY.restoreLoading
                : CONTENT_DETAIL_COPY.restoreButton
              : deleting
                ? CONTENT_DETAIL_COPY.deleteButtonLoading
                : CONTENT_DETAIL_COPY.deleteButton}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
