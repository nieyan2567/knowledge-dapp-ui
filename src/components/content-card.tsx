"use client";

import Link from "next/link";
import { useAccount, useWriteContract } from "wagmi";
import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { getIpfsFileUrl } from "@/lib/ipfs";
import { BookOpen, Coins, ExternalLink, Heart } from "lucide-react";
import { toast } from "sonner";
import { txToast } from "@/lib/tx-toast";
import type { ContentCardData } from "@/types/content";

function shortenAddress(address: string) {
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ContentCard({
	content,
	onActionComplete,
}: {
	content: ContentCardData;
	onActionComplete?: () => void | Promise<void>;
}) {
	const { address } = useAccount();
	const { writeContractAsync } = useWriteContract();
	const refreshAfterTx = useRefreshOnTxConfirmed();

	const fileUrl = getIpfsFileUrl(content.ipfsHash);

	async function handleVote() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		try {
			const hash = await txToast(
				writeContractAsync({
					address: CONTRACTS.KnowledgeContent as `0x${string}`,
					abi: ABIS.KnowledgeContent,
					functionName: "vote",
					args: [content.id],
					account: address,
				}),
				"正在提交投票交易...",
				"投票交易已提交",
				"投票失败"
			);

			await refreshAfterTx(hash, onActionComplete, ["content", "dashboard"]);
		} catch (error) {
			console.error(error);
		}
	}

	async function handleDistributeReward() {
		if (!address) {
			toast.error("请先连接钱包");
			return;
		}

		try {
			const hash = await txToast(
				writeContractAsync({
					address: CONTRACTS.KnowledgeContent as `0x${string}`,
					abi: ABIS.KnowledgeContent,
					functionName: "distributeReward",
					args: [content.id],
					account: address,
				}),
				"正在提交奖励记账交易...",
				"奖励记账交易已提交",
				"奖励记账失败"
			);

			await refreshAfterTx(hash, onActionComplete, ["content", "rewards", "dashboard", "system"]);
		} catch (error) {
			console.error(error);
		}
	}

	return (
		<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
			<div className="mb-4 flex items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
						<BookOpen className="h-4 w-4" />
						Content #{content.id.toString()}
					</div>

					<Link
						href={`/content/${content.id.toString()}`}
						className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">
						{content.title}
					</Link>

					<div className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
						{content.description || "暂无描述"}
					</div>
				</div>
			</div>

			<div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
				<div title={content.author}>作者: {shortenAddress(content.author)}</div>
				<div>票数: {content.voteCount.toString()}</div>
				<div>时间: {new Date(Number(content.timestamp) * 1000).toLocaleString()}</div>
				<div>奖励状态: {content.rewardAccrued ? "已记账" : "未记账"}</div>

				<div className="break-all text-xs text-slate-500 dark:text-slate-400" title={content.ipfsHash}>
					CID: {content.ipfsHash}
				</div>

				<div className="pt-1">
					<a
						href={fileUrl}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
						title={content.ipfsHash}
					>
						查看文件
						<ExternalLink className="h-4 w-4" />
					</a>
				</div>
			</div>

			<div className="mt-5 flex flex-wrap gap-3">
				<button
					onClick={handleVote}
					className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
				>
					<Heart className="h-4 w-4" />
					Vote
				</button>

				<button
					onClick={handleDistributeReward}
					className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
				>
					<Coins className="h-4 w-4" />
					Accrue Reward
				</button>
			</div>
		</div>
	);
}
