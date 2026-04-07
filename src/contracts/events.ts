import { parseAbiItem } from "viem";

export const rewardAccrueRequestedEvent = parseAbiItem(
  "event RewardAccrueRequested(uint256 indexed contentId, address indexed author, uint256 amount, uint256 voteCountAtAccrual)"
);

export const contentRegisteredEvent = parseAbiItem(
  "event ContentRegistered(uint256 id, address indexed author, string ipfsHash, string title, string description)"
);

export const contentUpdatedEvent = parseAbiItem(
  "event ContentUpdated(uint256 indexed id, address indexed author, string ipfsHash, string title, string description)"
);

export const contentDeletedEvent = parseAbiItem(
  "event ContentDeleted(uint256 indexed id, address indexed operator, address indexed author)"
);

export const contentRestoredEvent = parseAbiItem(
  "event ContentRestored(uint256 indexed id, address indexed operator, address indexed author)"
);

export const contentVersionStoredEvent = parseAbiItem(
  "event ContentVersionStored(uint256 indexed id, uint256 indexed version, string ipfsHash, string title, string description)"
);

export const contentVotedEvent = parseAbiItem(
  "event Voted(uint256 indexed contentId, address indexed voter)"
);

export const rewardClaimedEvent = parseAbiItem(
  "event RewardClaimed(address indexed beneficiary, uint256 amount)"
);

export const depositedEvent = parseAbiItem(
  "event Deposited(address indexed user, uint256 amount, uint256 activateAfterBlock)"
);

export const activatedEvent = parseAbiItem(
  "event Activated(address indexed user, uint256 amount)"
);

export const pendingStakeCanceledEvent = parseAbiItem(
  "event PendingStakeCanceled(address indexed user, uint256 amount, uint256 remainingPendingStake)"
);

export const withdrawRequestedEvent = parseAbiItem(
  "event WithdrawRequested(address indexed user, uint256 amount, uint256 withdrawAfterTime)"
);

export const withdrawnEvent = parseAbiItem(
  "event Withdrawn(address indexed user, uint256 amount)"
);

export const proposalCreatedEvent = parseAbiItem(
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"
);
