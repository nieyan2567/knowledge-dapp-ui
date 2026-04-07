import type { PublicClient } from "viem";

import { ABIS, CONTRACTS } from "@/contracts";
import {
  CONTENT_FETCH_CHUNK_SIZE,
  parseContentResults,
} from "@/lib/content-page-helpers";
import { asContentData, asContentVersion } from "@/lib/web3-types";
import type { ContentCardData, ContentData, ContentVersionData } from "@/types/content";

export async function readContentCountFromChain(publicClient: PublicClient) {
  const chainContentCount = await publicClient.readContract({
    address: CONTRACTS.KnowledgeContent as `0x${string}`,
    abi: ABIS.KnowledgeContent,
    functionName: "contentCount",
  });

  return typeof chainContentCount === "bigint" ? chainContentCount : 0n;
}

export async function readContentsFromChain(
  publicClient: PublicClient,
  total: number
) {
  if (total <= 0) {
    return [] satisfies ContentCardData[];
  }

  const ids = Array.from({ length: total }, (_, index) => BigInt(index + 1));
  const parsedContents: ContentCardData[] = [];

  for (let start = 0; start < ids.length; start += CONTENT_FETCH_CHUNK_SIZE) {
    const chunk = ids.slice(start, start + CONTENT_FETCH_CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map((id) =>
        publicClient.readContract({
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "contents",
          args: [id],
        })
      )
    );
    const rewardAccrualCounts = (await Promise.all(
      chunk.map((id) =>
        publicClient.readContract({
          address: CONTRACTS.KnowledgeContent as `0x${string}`,
          abi: ABIS.KnowledgeContent,
          functionName: "rewardAccrualCount",
          args: [id],
        })
      )
    )) as bigint[];

    parsedContents.push(
      ...parseContentResults(chunkResults, rewardAccrualCounts, asContentData)
    );
  }

  return parsedContents;
}

export async function readContentDetailFromChain(
  publicClient: PublicClient,
  contentId: bigint
): Promise<{
  content: ContentData | null;
  versionCount: bigint;
  rewardAccrualCount: bigint;
  versions: ContentVersionData[];
}> {
  const [contentData, versionCountData, rewardAccrualCountData] =
    await Promise.all([
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "contents",
        args: [contentId],
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "contentVersionCount",
        args: [contentId],
      }),
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "rewardAccrualCount",
        args: [contentId],
      }),
    ]);

  const content = asContentData(contentData) ?? null;
  const versionCount = typeof versionCountData === "bigint" ? versionCountData : 0n;
  const rewardAccrualCount =
    typeof rewardAccrualCountData === "bigint" ? rewardAccrualCountData : 0n;

  if (!content || versionCount <= 0n) {
    return {
      content,
      versionCount,
      rewardAccrualCount,
      versions: [],
    };
  }

  const versionIds = Array.from(
    { length: Number(versionCount) },
    (_, index) => BigInt(index + 1)
  );
  const results = await Promise.all(
    versionIds.map((version) =>
      publicClient.readContract({
        address: CONTRACTS.KnowledgeContent as `0x${string}`,
        abi: ABIS.KnowledgeContent,
        functionName: "getContentVersion",
        args: [contentId, version],
      })
    )
  );

  const versions = results
    .map((item, index) => asContentVersion(item, versionIds[index]))
    .filter((item): item is ContentVersionData => !!item)
    .sort((left, right) => Number(right.version - left.version));

  return {
    content,
    versionCount,
    rewardAccrualCount,
    versions,
  };
}
