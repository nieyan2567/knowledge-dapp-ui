import type { ContentCardData } from "@/types/content";
import type { ProposalItem } from "@/types/governance";
import type {
  RewardHistoryItem,
  RewardSourceItem,
} from "@/lib/reward-events";
import { keccak256, stringToBytes, toHex } from "viem";

type IndexedContentsResponse = {
  items: Array<{
    content_id: string;
    author_address: string;
    title: string;
    description: string;
    cid: string;
    latest_version: string;
    version_count: string;
    vote_count: string;
    reward_accrual_count: string;
    is_deleted: number;
    created_block_number: string;
    updated_block_number: string;
    created_at_second: string;
    last_updated_at_second: string;
    create_time: string;
    update_time: string;
  }>;
  page: number;
  page_size: number;
  total: number;
};

type IndexedContentDetailResponse = {
  content: IndexedContentsResponse["items"][number];
  versions: Array<{
    version_number: string;
    title: string;
    description: string;
    cid: string;
    block_number: string;
    tx_hash: string;
    version_timestamp_second: string;
  }>;
};

type IndexedProfileSummary = {
  address: string;
  content_count: number;
  proposal_count: number;
  vote_amount: string;
  pending_reward_amount: string;
  staked_amount: string;
  pending_stake_amount: string;
  pending_withdraw_amount: string;
  activate_after_block: string;
  withdraw_after_time: string;
  is_active: number;
  create_time: string | null;
  update_time: string | null;
};

type IndexedStakeSummary = {
  address: string;
  vote_amount: string;
  staked_amount: string;
  pending_stake_amount: string;
  pending_withdraw_amount: string;
  activate_after_block: string;
  withdraw_after_time: string;
  is_active: number;
  create_time: string | null;
  update_time: string | null;
};

type IndexedProposalRecord = {
  proposal_id: string;
  proposer: `0x${string}`;
  description: string;
  block_number: string;
  vote_start: string;
  vote_end: string;
  targets: `0x${string}`[];
  values: string[];
  calldatas: `0x${string}`[];
  transaction_hash?: `0x${string}`;
  state_value?: string | null;
  eta_second?: string | null;
  for_vote_amount?: string;
  against_vote_amount?: string;
  abstain_vote_amount?: string;
};

type IndexedProposalResponse = IndexedProposalRecord[];

type IndexedRewardActivityResponse = {
  historyItems: Array<{
    id: string;
    kind: "accrued" | "claimed";
    amount: string;
    blockNumber: string;
    timestamp?: string;
    contentId?: string;
    contentTitle?: string;
    txHash?: `0x${string}`;
    beneficiary?: `0x${string}`;
    author?: `0x${string}`;
  }>;
  rewardSources: Array<{
    contentId: string;
    title: string;
    totalAmount: string;
    accrualCount: number;
    latestBlock: string;
  }>;
};

type IndexedSystemSnapshot = {
  content_owner_address: string | null;
  votes_contract_address: string | null;
  treasury_contract_address: string | null;
  content_register_fee_amount: string;
  content_update_fee_amount: string;
  edit_lock_votes: string;
  is_allow_delete_after_vote: number;
  max_versions_per_content: string;
  treasury_owner_address: string | null;
  epoch_budget_amount: string;
  epoch_spent_amount: string;
  timelock_min_delay_second: string;
  governor_token_address: string | null;
  late_quorum_vote_extension_block: string;
  proposal_threshold_amount: string;
  proposal_fee_amount: string;
  voting_delay_block: string;
  voting_period_block: string;
  activation_blocks: string;
  cooldown_seconds: string;
  create_time: string;
  update_time: string;
};

type FetchJsonResult<T> =
  | {
      kind: "ok";
      data: T;
    }
  | {
      kind: "unavailable";
    };

function mapIndexedContentItem(
  item: IndexedContentsResponse["items"][number]
): ContentCardData {
  const rewardAccrualCount = BigInt(item.reward_accrual_count);

  return {
    id: BigInt(item.content_id),
    author: item.author_address as `0x${string}`,
    ipfsHash: item.cid,
    title: item.title,
    description: item.description,
    voteCount: BigInt(item.vote_count),
    timestamp: BigInt(item.created_at_second),
    rewardAccrued: rewardAccrualCount > 0n,
    deleted: item.is_deleted === 1,
    latestVersion: BigInt(item.latest_version),
    lastUpdatedAt: BigInt(item.last_updated_at_second),
    rewardAccrualCount,
  };
}

async function fetchIndexerJson<T>(input: string): Promise<FetchJsonResult<T>> {
  const response = await fetch(input, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (response.status === 503) {
    return { kind: "unavailable" };
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || `Indexer request failed: ${response.status}`);
  }

  return {
    kind: "ok",
    data: (await response.json()) as T,
  };
}

export async function fetchAllIndexedContents(input?: {
  author_address?: `0x${string}`;
  include_deleted?: boolean;
}) {
  const params = new URLSearchParams();
  if (input?.author_address) {
    params.set("author_address", input.author_address);
  }
  if (input?.include_deleted) {
    params.set("include_deleted", "true");
  }
  params.set("page_size", "50");

  const allItems: ContentCardData[] = [];
  let page = 1;
  let total = 0;

  while (true) {
    params.set("page", String(page));
    const result = await fetchIndexerJson<IndexedContentsResponse>(
      `/api/index/contents?${params.toString()}`
    );

    if (result.kind === "unavailable") {
      return null;
    }

    total = result.data.total;
    allItems.push(...result.data.items.map(mapIndexedContentItem));

    if (allItems.length >= total || result.data.items.length === 0) {
      break;
    }

    page += 1;
  }

  return allItems;
}

export async function fetchIndexedProfileSummary(address: `0x${string}`) {
  const result = await fetchIndexerJson<IndexedProfileSummary>(
    `/api/index/profile/${address}`
  );

  if (result.kind === "unavailable") {
    return null;
  }

  return result.data;
}

export async function fetchIndexedContentDetail(contentId: bigint) {
  try {
    const result = await fetchIndexerJson<IndexedContentDetailResponse>(
      `/api/index/contents/${contentId.toString()}`
    );

    if (result.kind === "unavailable") {
      return null;
    }

    return {
      content: mapIndexedContentItem(result.data.content),
      versions: result.data.versions.map((version) => ({
        version: BigInt(version.version_number),
        ipfsHash: version.cid,
        title: version.title,
        description: version.description,
        timestamp: BigInt(version.version_timestamp_second),
      })),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Indexer request failed: 404")
    ) {
      return null;
    }

    throw error;
  }
}

export async function fetchIndexedStakeSummary(address: `0x${string}`) {
  const result = await fetchIndexerJson<IndexedStakeSummary>(
    `/api/index/stake/${address}`
  );

  if (result.kind === "unavailable") {
    return null;
  }

  return result.data;
}

export async function fetchIndexedProposals(input?: {
  proposer_address?: `0x${string}`;
}) {
  const params = new URLSearchParams();
  if (input?.proposer_address) {
    params.set("proposer_address", input.proposer_address);
  }

  const result = await fetchIndexerJson<IndexedProposalResponse>(
    `/api/index/proposals${params.size > 0 ? `?${params.toString()}` : ""}`
  );

  if (result.kind === "unavailable") {
    return null;
  }

  return result.data.map(mapIndexedProposalItem);
}

function mapIndexedProposalItem(item: IndexedProposalRecord): ProposalItem {
  return {
    proposalId: BigInt(item.proposal_id),
    proposer: item.proposer,
    description: item.description,
    descriptionHash: keccak256(toHex(stringToBytes(item.description))),
    blockNumber: BigInt(item.block_number),
    voteStart: BigInt(item.vote_start),
    voteEnd: BigInt(item.vote_end),
    targets: item.targets,
    values: item.values.map((value) => BigInt(value)),
    calldatas: item.calldatas,
    transactionHash: item.transaction_hash,
    stateValue:
      item.state_value !== undefined && item.state_value !== null
        ? BigInt(item.state_value)
        : undefined,
    etaSecond:
      item.eta_second !== undefined && item.eta_second !== null
        ? BigInt(item.eta_second)
        : undefined,
    votes:
      item.for_vote_amount !== undefined &&
      item.against_vote_amount !== undefined &&
      item.abstain_vote_amount !== undefined
        ? {
            forVotes: BigInt(item.for_vote_amount),
            againstVotes: BigInt(item.against_vote_amount),
            abstainVotes: BigInt(item.abstain_vote_amount),
          }
        : undefined,
  };
}

export async function fetchIndexedProposalDetail(proposalId: bigint) {
  try {
    const result = await fetchIndexerJson<IndexedProposalRecord>(
      `/api/index/proposals/${proposalId.toString()}`
    );

    if (result.kind === "unavailable") {
      return null;
    }

    return mapIndexedProposalItem(result.data);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Indexer request failed: 404")
    ) {
      return null;
    }

    throw error;
  }
}

export async function fetchIndexedRewardActivity(address?: `0x${string}`) {
  const params = new URLSearchParams();
  if (address) {
    params.set("address", address);
  }

  const result = await fetchIndexerJson<IndexedRewardActivityResponse>(
    `/api/index/rewards${params.size > 0 ? `?${params.toString()}` : ""}`
  );

  if (result.kind === "unavailable") {
    return null;
  }

  return {
    historyItems: result.data.historyItems.map<RewardHistoryItem>((item) => ({
      id: item.id,
      kind: item.kind,
      amount: BigInt(item.amount),
      blockNumber: BigInt(item.blockNumber),
      timestamp: item.timestamp ? BigInt(item.timestamp) : undefined,
      contentId: item.contentId ? BigInt(item.contentId) : undefined,
      contentTitle: item.contentTitle,
      txHash: item.txHash,
      beneficiary: item.beneficiary,
      author: item.author,
    })),
    rewardSources: result.data.rewardSources.map<RewardSourceItem>((item) => ({
      contentId: BigInt(item.contentId),
      title: item.title,
      totalAmount: BigInt(item.totalAmount),
      accrualCount: item.accrualCount,
      latestBlock: BigInt(item.latestBlock),
    })),
  };
}

export async function fetchIndexedSystemSnapshot() {
  try {
    const result = await fetchIndexerJson<IndexedSystemSnapshot>("/api/index/system");

    if (result.kind === "unavailable") {
      return null;
    }

    return result.data;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Indexer request failed: 404")
    ) {
      return null;
    }

    throw error;
  }
}
