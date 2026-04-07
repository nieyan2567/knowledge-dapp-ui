import { getIndexerPool } from "../db";

const MAX_PAGE_SIZE = 50;

export type IndexedContentItem = {
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
};

export type IndexedContentVersionItem = {
  version_number: string;
  title: string;
  description: string;
  cid: string;
  block_number: string;
  tx_hash: string;
  version_timestamp_second: string;
};

export type ListIndexedContentsParams = {
  page?: number;
  page_size?: number;
  author_address?: string;
  include_deleted?: boolean;
};

export async function listIndexedContents(
  params: ListIndexedContentsParams = {}
) {
  const pool = getIndexerPool();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, params.page_size ?? 20)
  );
  const includeDeleted = params.include_deleted ?? false;
  const authorAddress = params.author_address?.trim().toLowerCase();
  const values: Array<string | number> = [];
  const where: string[] = [];

  if (!includeDeleted) {
    where.push("is_deleted = 0");
  }

  if (authorAddress) {
    values.push(authorAddress);
    where.push(`lower(author_address) = $${values.length}`);
  }

  const whereClause = where.length > 0 ? `where ${where.join(" and ")}` : "";

  values.push(pageSize);
  const limitParam = `$${values.length}`;
  values.push((page - 1) * pageSize);
  const offsetParam = `$${values.length}`;

  const [itemsResult, countResult] = await Promise.all([
    pool.query<IndexedContentItem>(
      `
        select
          content_id,
          author_address,
          title,
          description,
          cid,
          latest_version,
          version_count,
          vote_count,
          reward_accrual_count,
          is_deleted,
          created_block_number,
          updated_block_number,
          created_at_second::text as created_at_second,
          last_updated_at_second::text as last_updated_at_second,
          create_time::text as create_time,
          update_time::text as update_time
        from content
        ${whereClause}
        order by updated_block_number desc, content_id desc
        limit ${limitParam}
        offset ${offsetParam}
      `,
      values
    ),
    pool.query<{ total: string }>(
      `
        select count(*)::text as total
        from content
        ${whereClause}
      `,
      values.slice(0, values.length - 2)
    ),
  ]);

  return {
    items: itemsResult.rows,
    page,
    page_size: pageSize,
    total: Number(countResult.rows[0]?.total ?? "0"),
  };
}

export async function getIndexedContentById(contentId: bigint) {
  const pool = getIndexerPool();
  const contentResult = await pool.query<IndexedContentItem>(
    `
      select
        content_id::text as content_id,
        btrim(author_address) as author_address,
        title,
        description,
        cid,
        latest_version::text as latest_version,
        version_count::text as version_count,
        vote_count::text as vote_count,
        reward_accrual_count::text as reward_accrual_count,
        is_deleted,
        created_block_number::text as created_block_number,
        updated_block_number::text as updated_block_number,
        created_at_second::text as created_at_second,
        last_updated_at_second::text as last_updated_at_second,
        create_time::text as create_time,
        update_time::text as update_time
      from content
      where content_id = $1
      limit 1
    `,
    [contentId.toString()]
  );

  const content = contentResult.rows[0];

  if (!content) {
    return null;
  }

  const versionResult = await pool.query<IndexedContentVersionItem>(
    `
      select
        version_number::text as version_number,
        title,
        description,
        cid,
        block_number::text as block_number,
        btrim(tx_hash) as tx_hash,
        version_timestamp_second::text as version_timestamp_second
      from content_version
      where content_id = $1
      order by version_number desc
    `,
    [contentId.toString()]
  );

  return {
    content,
    versions: versionResult.rows,
  };
}
