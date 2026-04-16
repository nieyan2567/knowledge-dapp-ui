"use client";

/**
 * 模块说明：内容卡片组件，负责在列表中展示单条内容摘要，并提供投票和奖励记账快捷操作。
 */
import Link from "next/link";
import { BookOpen, Coins, ExternalLink, Heart } from "lucide-react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import { ABIS, CONTRACTS } from "@/contracts";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { getIpfsFileUrl } from "@/lib/ipfs";
import { writeTxToast } from "@/lib/tx-toast";
import type { ContentCardData } from "@/types/content";

/**
 * 缩写内容作者地址。
 * @param address 需要显示的作者地址。
 * @returns 截断后的地址文本。
 */
function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * 渲染单条内容卡片。
 * @param content 当前卡片对应的内容数据。
 * @param onActionComplete 链上操作完成后的回调。
 * @returns 可用于内容列表的摘要卡片。
 */
export function ContentCard({
  content,
  onActionComplete,
}: {
  content: ContentCardData;
  onActionComplete?: () => void | Promise<void>;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const refreshAfterTx = useRefreshOnTxConfirmed();
  const isAuthor =
    !!address && content.author.toLowerCase() === address.toLowerCase();

  const fileUrl = getIpfsFileUrl(content.ipfsHash);

  /**
   * 发起内容投票交易。
   * @returns 成功时等待交易确认并刷新相关页面域。
   */
  async function handleVote() {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    try {
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
        loading: "正在提交投票交易...",
        success: "投票交易已提交",
        fail: "投票失败",
      });

      if (!hash) {
        return;
      }

      await refreshAfterTx(hash, onActionComplete, ["content", "dashboard"]);
    } catch {}
  }

  /**
   * 由作者发起奖励记账交易。
   * @returns 成功时等待交易确认并刷新奖励相关页面域。
   */
  async function handleDistributeReward() {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    if (!isAuthor) {
      toast.error("只有内容作者可以发起奖励记账");
      return;
    }

    try {
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

      if (!hash) {
        return;
      }

      await refreshAfterTx(hash, onActionComplete, [
        "content",
        "rewards",
        "dashboard",
        "system",
      ]);
    } catch {}
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <BookOpen className="h-4 w-4" />
            内容 #{content.id.toString()}
          </div>

          <Link
            href={`/content/${content.id.toString()}`}
            className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100"
          >
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
        <div>发布时间: {new Date(Number(content.timestamp) * 1000).toLocaleString()}</div>
        <div>
          奖励状态:{" "}
          {content.rewardAccrualCount > 0n
            ? `第 ${content.rewardAccrualCount.toString()} 次记账`
            : "未记账"}
        </div>
        <div>内容状态: {content.deleted ? "已删除" : "正常"}</div>

        <div
          className="break-all text-xs text-slate-500 dark:text-slate-400"
          title={content.ipfsHash}
        >
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
          disabled={content.deleted}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          <Heart className="h-4 w-4" />
          投票
        </button>

        <button
          onClick={handleDistributeReward}
          disabled={content.deleted || !isAuthor}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Coins className="h-4 w-4" />
          奖励记账
        </button>
      </div>
    </div>
  );
}
