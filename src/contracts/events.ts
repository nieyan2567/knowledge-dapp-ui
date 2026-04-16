/**
 * @file 合约事件定义模块。
 * @description 维护前端事件查询和日志解析时使用的 ABI 事件片段。
 */
import { parseAbiItem } from "viem";

/**
 * @notice 内容奖励累计请求事件定义。
 */
export const rewardAccrueRequestedEvent = parseAbiItem(
  "event RewardAccrueRequested(uint256 indexed contentId, address indexed author, uint256 amount, uint256 voteCountAtAccrual)"
);

/**
 * @notice 奖励领取事件定义。
 */
export const rewardClaimedEvent = parseAbiItem(
  "event RewardClaimed(address indexed beneficiary, uint256 amount)"
);

/**
 * @notice 治理提案创建事件定义。
 */
export const proposalCreatedEvent = parseAbiItem(
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"
);
