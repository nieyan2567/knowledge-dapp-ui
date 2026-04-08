import { parseAbiItem } from "viem";

export const rewardAccrueRequestedEvent = parseAbiItem(
  "event RewardAccrueRequested(uint256 indexed contentId, address indexed author, uint256 amount, uint256 voteCountAtAccrual)"
);

export const rewardClaimedEvent = parseAbiItem(
  "event RewardClaimed(address indexed beneficiary, uint256 amount)"
);

export const proposalCreatedEvent = parseAbiItem(
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"
);
