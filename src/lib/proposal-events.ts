/**
 * @notice ProposalCreated 事件抓取与解析工具。
 * @dev 负责从链上批量读取提案创建事件，并转换为前端使用的提案结构。
 */
import type { PublicClient } from "viem";

import { CONTRACTS } from "@/contracts";
import { proposalCreatedEvent } from "@/contracts/events";
import { collectByBlockRange } from "@/lib/block-range";
import { parseProposalCreatedLog } from "@/lib/governance";
import type { ProposalItem } from "@/types/governance";

/**
 * @notice 抓取全部提案创建日志。
 * @param publicClient 当前链的公共客户端。
 * @returns 从起始区块到最新区块的 ProposalCreated 日志数组。
 */
export async function fetchProposalLogs(publicClient: PublicClient) {
  const latestBlock = await publicClient.getBlockNumber();

  return collectByBlockRange({
    toBlock: latestBlock,
    fetchRange: ({ fromBlock, toBlock }) =>
      publicClient.getLogs({
        address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
        event: proposalCreatedEvent,
        fromBlock,
        toBlock,
      }),
  });
}

/**
 * @notice 获取并解析全部提案。
 * @param publicClient 当前链的公共客户端。
 * @returns 解析后的提案列表。
 */
export async function fetchParsedProposals(publicClient: PublicClient) {
  const logs = await fetchProposalLogs(publicClient);
  return logs.map((log) => parseProposalCreatedLog(log));
}

/**
 * @notice 获取最新创建的一条提案。
 * @param publicClient 当前链的公共客户端。
 * @returns 最新提案；若不存在则返回 `null`。
 */
export async function fetchLatestProposal(publicClient: PublicClient) {
  const proposals = await fetchParsedProposals(publicClient);
  return [...proposals].sort((left, right) => Number(right.blockNumber - left.blockNumber))[0] ?? null;
}

/**
 * @notice 根据提案 ID 获取提案详情。
 * @param publicClient 当前链的公共客户端。
 * @param proposalId 目标提案 ID。
 * @returns 匹配的提案详情；若不存在则返回 `null`。
 */
export async function fetchProposalDetail(
  publicClient: PublicClient,
  proposalId: bigint
) {
  const logs = await fetchProposalLogs(publicClient);
  const matched = logs.find((log) => {
    const logProposalId = log.args.proposalId;
    return typeof logProposalId === "bigint" && logProposalId === proposalId;
  });

  return matched ? parseProposalCreatedLog(matched) : null;
}

/**
 * @notice 获取指定提案发起人的全部提案。
 * @param publicClient 当前链的公共客户端。
 * @param proposer 目标发起人地址。
 * @returns 属于该发起人的提案列表，按区块从新到旧排序。
 */
export async function fetchProposalsByProposer(
  publicClient: PublicClient,
  proposer: `0x${string}`
) {
  const proposals = await fetchParsedProposals(publicClient);
  return proposals
    .filter((proposal) => proposal.proposer.toLowerCase() === proposer.toLowerCase())
    .sort((left, right) => Number(right.blockNumber - left.blockNumber));
}

/**
 * @notice 按区块从新到旧排序提案列表。
 * @param proposals 待排序的提案数组。
 * @returns 排序后的新数组。
 */
export function sortProposalsByNewest(proposals: ProposalItem[]) {
  return [...proposals].sort((left, right) => Number(right.blockNumber - left.blockNumber));
}
