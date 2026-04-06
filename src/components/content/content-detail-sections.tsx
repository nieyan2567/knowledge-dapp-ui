"use client";

import { BookOpen, CheckCircle2, ExternalLink, FileText, Heart, User } from "lucide-react";

import { AddressBadge } from "@/components/address-badge";
import { CopyField } from "@/components/copy-field";
import {
  CONTENT_DETAIL_COPY,
  formatComparedVersion,
  formatContentDate,
  formatRewardStatus,
  formatVersionRecordedAt,
  getVersionChangeSummary,
} from "@/lib/content-detail-helpers";
import { getIpfsFileUrl } from "@/lib/ipfs";
import type { ContentVersionData } from "@/types/content";

export function ContentStatusSummaryGrid({
  items,
}: {
  items: ReadonlyArray<{
    label: string;
    value: string;
    description: string;
  }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <StatusSummaryCard
          key={item.label}
          label={item.label}
          value={item.value}
          description={item.description}
        />
      ))}
    </div>
  );
}

export function ContentCurrentFileSection({
  contentId,
  latestVersion,
  deleted,
  title,
  description,
  previewUrl,
  currentCid,
}: {
  contentId: bigint;
  latestVersion: bigint;
  deleted: boolean;
  title: string;
  description: string;
  previewUrl: string;
  currentCid: string;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <BookOpen className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          {CONTENT_DETAIL_COPY.recordSummaryTitle}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryPill
            label={CONTENT_DETAIL_COPY.contentIdLabel}
            value={`#${contentId.toString()}`}
          />
          <SummaryPill
            label={CONTENT_DETAIL_COPY.latestVersionLabel}
            value={`v${latestVersion.toString()}`}
          />
          <SummaryPill
            label={CONTENT_DETAIL_COPY.statusLabel}
            value={deleted ? CONTENT_DETAIL_COPY.statusDeleted : CONTENT_DETAIL_COPY.statusNormal}
          />
        </div>
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {CONTENT_DETAIL_COPY.titleLabel}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">
              {title}
            </span>
          </div>
          <div className="mt-2 flex items-start gap-2">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {CONTENT_DETAIL_COPY.descriptionLabel}
            </span>
            <span className="flex-1 text-xs leading-5 text-slate-700 dark:text-slate-300">
              {description || CONTENT_DETAIL_COPY.noDescription}
            </span>
          </div>
        </div>
      </div>

      <a
        href={previewUrl}
        target="_blank"
        rel="noreferrer"
        className="group block rounded-3xl border border-slate-200 bg-slate-50 p-8 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
      >
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
            <FileText className="h-8 w-8" />
          </div>

          <div>
            <div className="text-base font-semibold text-slate-950 dark:text-slate-100">
              {CONTENT_DETAIL_COPY.openCurrentFileTitle}
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {CONTENT_DETAIL_COPY.activeVersionText.replace(
                "{version}",
                latestVersion.toString()
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300">
            {CONTENT_DETAIL_COPY.openFile}
            <ExternalLink className="h-4 w-4" />
          </div>
        </div>
      </a>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {CONTENT_DETAIL_COPY.currentMetadataTitle}
        </div>
        <div className="space-y-3">
          <CopyField label={CONTENT_DETAIL_COPY.currentCidLabel} value={currentCid} />
          <CopyField label={CONTENT_DETAIL_COPY.gatewayUrlLabel} value={previewUrl} />
        </div>
      </div>
    </div>
  );
}

export function ContentSnapshotGrid({
  author,
  createdAt,
  latestVersion,
  versionCount,
  lastUpdatedAt,
  voteCount,
  rewardAccrualCount,
}: {
  author: `0x${string}`;
  createdAt: bigint;
  latestVersion: bigint;
  versionCount: bigint;
  lastUpdatedAt: bigint;
  voteCount: bigint;
  rewardAccrualCount: bigint;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InfoCard label={CONTENT_DETAIL_COPY.authorLabel}>
        <div className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
          <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <AddressBadge address={author} />
        </div>
      </InfoCard>

      <InfoCard label={CONTENT_DETAIL_COPY.createdAtLabel}>
        {formatContentDate(createdAt)}
      </InfoCard>
      <InfoCard label={CONTENT_DETAIL_COPY.latestVersionSummaryLabel}>
        v{latestVersion.toString()} / {versionCount.toString()} 个版本
      </InfoCard>
      <InfoCard label={CONTENT_DETAIL_COPY.updatedAtLabel}>
        {formatContentDate(lastUpdatedAt)}
      </InfoCard>
      <InfoCard label={CONTENT_DETAIL_COPY.votesLabel}>
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          {voteCount.toString()}
        </div>
      </InfoCard>
      <InfoCard label={CONTENT_DETAIL_COPY.rewardStatusLabel}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          {formatRewardStatus(rewardAccrualCount)}
        </div>
      </InfoCard>
    </div>
  );
}

export function ContentVersionHistoryList({
  loadingVersions,
  versions,
  latestVersion,
  onCopyCid,
}: {
  loadingVersions: boolean;
  versions: ContentVersionData[];
  latestVersion: bigint;
  onCopyCid: (value: string, label: string) => void;
}) {
  if (loadingVersions) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
        {CONTENT_DETAIL_COPY.loadingVersionHistory}
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
        {CONTENT_DETAIL_COPY.emptyVersionHistory}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {versions.map((version, index) => {
        const isCurrentVersion = version.version === latestVersion;
        const versionUrl = getIpfsFileUrl(version.ipfsHash);
        const previousVersion = versions[index + 1];
        const changeSummary = getVersionChangeSummary(version, previousVersion);

        return (
          <div
            key={version.version.toString()}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                  {CONTENT_DETAIL_COPY.versionPrefix.replace(
                    "{version}",
                    version.version.toString()
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {formatVersionRecordedAt(version.timestamp)}
                </div>
              </div>

              <div
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  isCurrentVersion
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {isCurrentVersion
                  ? CONTENT_DETAIL_COPY.currentVersionBadge
                  : CONTENT_DETAIL_COPY.historicalVersionBadge}
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900/80">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {CONTENT_DETAIL_COPY.changeSummaryTitle}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {changeSummary.map((item) => (
                    <span
                      key={`${version.version.toString()}-${item}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {previousVersion
                    ? formatComparedVersion(previousVersion.version)
                    : CONTENT_DETAIL_COPY.initialVersionRecord}
                </div>
              </div>
              <div>
                {CONTENT_DETAIL_COPY.versionTitlePrefix}
                {version.title}
              </div>
              <div>
                {CONTENT_DETAIL_COPY.versionDescriptionPrefix}
                {version.description || CONTENT_DETAIL_COPY.noDescription}
              </div>
              <div className="break-all text-xs text-slate-500 dark:text-slate-400">
                {CONTENT_DETAIL_COPY.versionCidPrefix}
                {version.ipfsHash}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={versionUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {CONTENT_DETAIL_COPY.openFile}
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => onCopyCid(version.ipfsHash, "CID")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {CONTENT_DETAIL_COPY.copyCid}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{children}</div>
    </div>
  );
}

function StatusSummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </div>
    </div>
  );
}
