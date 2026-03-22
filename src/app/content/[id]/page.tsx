"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { toast } from "sonner";
import {
	ArrowLeft,
	BookOpen,
	CheckCircle2,
	Coins,
	ExternalLink,
	FileText,
	Heart,
	User,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { CopyField } from "@/components/copy-field";
import { AddressBadge } from "@/components/address-badge";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { getIpfsFileUrl } from "@/lib/ipfs";
import { writeTxToast } from "@/lib/tx-toast";
import { asContentData } from "@/lib/web3-types";

function formatDate(timestamp: bigint) {
	return new Date(Number(timestamp) * 1000).toLocaleString();
}

export default function ContentDetailPage() {
	const params = useParams();
	const { address } = useAccount();
	const publicClient = usePublicClient();
	const { writeContractAsync } = useWriteContract();
	const refreshAfterTx = useRefreshOnTxConfirmed();

	const rawId = params?.id;
	const contentId = useMemo(() => {
		if (typeof rawId !== "string") return null;
		if (!/^\d+$/.test(rawId)) return null;
		return BigInt(rawId);
	}, [rawId]);

	const { data: contentData, isLoading, refetch: refetchContent } = useReadContract({
		address: CONTRACTS.KnowledgeContent as `0x${string}`,
		abi: ABIS.KnowledgeContent,
		functionName: "contents",
		args: contentId ? [contentId] : undefined,
		query: {
			enabled: !!contentId,
		},
	});

	if (!contentId) {
		notFound();
	}

	if (isLoading) {
		return (
			<main className="mx-auto max-w-7xl px-6 py-10">
				<div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
					正在加载内容详情...
				</div>
			</main>
		);
	}

	const content = asContentData(contentData);

	if (!content) {
		return (
			<main className="mx-auto max-w-7xl px-6 py-10 space-y-6">
				<Link
					href="/content"
					className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
				>
					<ArrowLeft className="h-4 w-4" />
					返回内容列表
				</Link>

				<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
					未找到该内容，可能内容 ID 不存在。
				</div>
			</main>
		);
	}

	const previewUrl = getIpfsFileUrl(content.ipfsHash);

	async function handleVote() {
		if (!content) {
			toast.error("内容数据加载失败");
			return;
		}

		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		const hash = await writeTxToast({
			publicClient,
			writeContractAsync,
			request: {
				address: CONTRACTS.KnowledgeContent as `0x${string}`,
				abi: ABIS.KnowledgeContent,
				functionName: "vote",
				args: [content.id],
				account: address,
			},
			loading: "正在提交投票...",
			success: "投票交易已提交",
			fail: "投票失败",
		});
		if (!hash) return;
		await refreshAfterTx(hash, refetchContent, ["content", "dashboard"]);
	}

	async function handleAccrueReward() {
		if (!content) {
			toast.error("内容数据加载失败");
			return;
		}

		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		const hash = await writeTxToast({
			publicClient,
			writeContractAsync,
			request: {
				address: CONTRACTS.KnowledgeContent as `0x${string}`,
				abi: ABIS.KnowledgeContent,
				functionName: "distributeReward",
				args: [content.id],
				account: address,
			},
			loading: "正在提交奖励记账交易...",
			success: "奖励记账交易已提交",
			fail: "奖励记账失败",
		});
		if (!hash) return;
		await refreshAfterTx(hash, refetchContent, ["content", "rewards", "dashboard", "system"]);
	}

	return (
		<main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
			<div className="flex items-center justify-between gap-4">
				<Link
					href="/content"
					className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
				>
					<ArrowLeft className="h-4 w-4" />
					返回内容列表
				</Link>

				<a
					href={previewUrl}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
				>
					查看 IPFS 原文件
					<ExternalLink className="h-4 w-4" />
				</a>
			</div>

			<PageHeader
				eyebrow={`内容 #${content.id.toString()}`}
				title={content.title}
				description={content.description || "暂无内容描述。"}
			/>

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
				{/* Left */}
				<div className="space-y-6">
					<SectionCard
						title="文件预览"
						description="点击下方区域可在本地 IPFS Gateway 中打开原始文件。"
					>
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
										打开 IPFS 文件
									</div>
									<div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
										通过本地 Gateway 访问该内容文件
									</div>
								</div>

								<div className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300">
									打开文件
									<ExternalLink className="h-4 w-4" />
								</div>
							</div>
						</a>
					</SectionCard>

					<SectionCard
						title="内容信息"
						description="链上登记的基础信息和内容元数据。"
					>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
								<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
									作者
								</div>
								<div className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
									<User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
									<AddressBadge address={content.author} />
								</div>
							</div>

							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
								<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
									上传时间
								</div>
								<div className="text-sm font-medium text-slate-900 dark:text-slate-100">
									{formatDate(content.timestamp)}
								</div>
							</div>

							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
								<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
									投票数
								</div>
								<div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
									<Heart className="h-4 w-4 text-slate-400 dark:text-slate-500" />
									{content.voteCount.toString()}
								</div>
							</div>

							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
								<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
									奖励状态
								</div>
								<div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
									<CheckCircle2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
									{content.rewardAccrued ? "已记账" : "未记账"}
								</div>
							</div>
						</div>
					</SectionCard>
				</div>

				{/* Right */}
				<div className="space-y-6">
					<SectionCard
						title="内容操作"
						description="对当前内容进行社区投票或触发奖励记账。"
					>
						<div className="space-y-3">
							<button
								onClick={handleVote}
								className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
							>
								<Heart className="h-4 w-4" />
								投票
							</button>

							<button
								onClick={handleAccrueReward}
								className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								<Coins className="h-4 w-4" />
								奖励记账
							</button>
						</div>
					</SectionCard>

					<SectionCard
						title="链上元数据"
						description="内容 CID 和本地网关访问地址。"
					>
						<div className="space-y-3">
							<CopyField label="CID" value={content.ipfsHash} />
							<CopyField label="本地网关地址" value={previewUrl} />
						</div>
					</SectionCard>

					<SectionCard
						title="记录摘要"
						description="这条内容在平台中的基础记录摘要。"
					>
						<div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
							<div className="flex items-center gap-2">
								<BookOpen className="h-4 w-4 text-slate-400 dark:text-slate-500" />
								<span>内容 ID: {content.id.toString()}</span>
							</div>
							<div>标题：{content.title}</div>
							<div>描述：{content.description || "暂无描述"}</div>
						</div>
					</SectionCard>
				</div>
			</div>
		</main>
	);
}
