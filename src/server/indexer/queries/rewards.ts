import type { RewardHistoryItem, RewardSourceItem } from "@/lib/reward-events";

import { getIndexerPool } from "../db";

type RewardHistoryRow = {
  event_id: string;
  event_kind: "accrued" | "claimed";
  amount: string;
  block_number: string;
  tx_hash: string;
  content_id: string | null;
  title: string | null;
  author_address: string | null;
  beneficiary_address: string | null;
  event_time: string | null;
};

type RewardSourceRow = {
  content_id: string;
  title: string | null;
  total_amount: string;
  accrual_count: string;
  latest_block: string;
};

function toTimestampSeconds(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return BigInt(Math.floor(parsed / 1000));
}

export async function getIndexedRewardActivity(input?: {
  address?: `0x${string}`;
}) {
  const pool = getIndexerPool();
  const normalizedAddress = input?.address?.toLowerCase();
  const historyWhereClause = normalizedAddress
    ? `
        where lower(coalesce(re.author_address, '')) = $1
           or lower(coalesce(re.beneficiary_address, '')) = $1
      `
    : "";
  const sourceWhereClause = normalizedAddress
    ? `
        where btrim(re.event_kind) = 'accrued'
          and lower(coalesce(re.author_address, '')) = $1
          and re.content_id is not null
      `
    : `
        where btrim(re.event_kind) = 'accrued'
          and re.content_id is not null
      `;
  const values = normalizedAddress ? [normalizedAddress] : [];

  const [historyResult, sourceResult] = await Promise.all([
    pool.query<RewardHistoryRow>(
      `
        select
          btrim(re.event_id) as event_id,
          btrim(re.event_kind) as event_kind,
          re.amount::text as amount,
          re.block_number::text as block_number,
          btrim(re.tx_hash) as tx_hash,
          re.content_id::text as content_id,
          c.title,
          nullif(btrim(re.author_address), '') as author_address,
          nullif(btrim(re.beneficiary_address), '') as beneficiary_address,
          re.event_time::text as event_time
        from reward_event re
        left join content c on c.content_id = re.content_id
        ${historyWhereClause}
        order by re.block_number desc, re.log_index desc
      `,
      values
    ),
    pool.query<RewardSourceRow>(
      `
        select
          re.content_id::text as content_id,
          c.title,
          sum(re.amount)::text as total_amount,
          count(*)::text as accrual_count,
          max(re.block_number)::text as latest_block
        from reward_event re
        left join content c on c.content_id = re.content_id
        ${sourceWhereClause}
        group by re.content_id, c.title
        order by max(re.block_number) desc
      `,
      values
    ),
  ]);

  const historyItems: RewardHistoryItem[] = historyResult.rows.map((row) => ({
    id: row.event_id,
    kind: row.event_kind,
    amount: BigInt(row.amount),
    blockNumber: BigInt(row.block_number),
    timestamp: toTimestampSeconds(row.event_time),
    contentId: row.content_id ? BigInt(row.content_id) : undefined,
    contentTitle: row.title ?? undefined,
    txHash: row.tx_hash as `0x${string}`,
    beneficiary: row.beneficiary_address?.toLowerCase() as `0x${string}` | undefined,
    author: row.author_address?.toLowerCase() as `0x${string}` | undefined,
  }));

  const rewardSources: RewardSourceItem[] = sourceResult.rows.map((row) => ({
    contentId: BigInt(row.content_id),
    title: row.title ?? `内容 #${row.content_id}`,
    totalAmount: BigInt(row.total_amount),
    accrualCount: Number(row.accrual_count),
    latestBlock: BigInt(row.latest_block),
  }));

  return {
    historyItems,
    rewardSources,
  };
}
