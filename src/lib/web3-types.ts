/**
 * @notice Web3 返回值类型收窄工具。
 * @dev 将合约读调用返回的未知值转换为前端可直接使用的强类型结构。
 */
import type { Address, HexString } from "@/types/contracts";
import type { ContentData, ContentVersionData } from "@/types/content";
import type { ProposalVotes } from "@/types/governance";

/**
 * @notice 将未知值安全收窄为 `bigint`。
 * @param value 待判断的值。
 * @returns 合法 `bigint` 值；若无法安全转换则返回 `undefined`。
 */
export function asBigInt(value: unknown): bigint | undefined {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }

  return undefined;
}

/**
 * @notice 将未知值安全收窄为合约地址。
 * @param value 待判断的值。
 * @returns 合法地址字符串；否则返回 `undefined`。
 */
export function asAddress(value: unknown): Address | undefined {
  return typeof value === "string" && value.startsWith("0x")
    ? (value as Address)
    : undefined;
}

/**
 * @notice 将未知值安全收窄为十六进制字符串。
 * @param value 待判断的值。
 * @returns 合法十六进制字符串；否则返回 `undefined`。
 */
export function asHex(value: unknown): HexString | undefined {
  return typeof value === "string" && value.startsWith("0x")
    ? (value as HexString)
    : undefined;
}

/**
 * @notice 将未知值解析为提案投票结构。
 * @param value 合约返回的原始投票数组。
 * @returns 解析后的投票结构；若结构不匹配则返回 `undefined`。
 */
export function asProposalVotes(
  value: unknown
): ProposalVotes | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined;

  const [againstVotes, forVotes, abstainVotes] = value as readonly unknown[];

  if (
    typeof againstVotes !== "bigint" ||
    typeof forVotes !== "bigint" ||
    typeof abstainVotes !== "bigint"
  ) {
    return undefined;
  }

  return {
    againstVotes,
    forVotes,
    abstainVotes,
  };
}

/**
 * @notice 将未知值解析为内容主数据结构。
 * @param value 合约返回的原始内容元组。
 * @returns 解析后的内容对象；若结构不匹配则返回 `undefined`。
 */
export function asContentData(value: unknown): ContentData | undefined {
  if (!Array.isArray(value) || value.length < 11) return undefined;

  const [
    id,
    author,
    ipfsHash,
    title,
    description,
    voteCount,
    timestamp,
    rewardAccrued,
    deleted,
    latestVersion,
    lastUpdatedAt,
  ] = value as readonly unknown[];

  if (
    typeof id !== "bigint" ||
    typeof author !== "string" ||
    typeof ipfsHash !== "string" ||
    typeof title !== "string" ||
    typeof description !== "string" ||
    typeof voteCount !== "bigint" ||
    typeof timestamp !== "bigint" ||
    typeof rewardAccrued !== "boolean" ||
    typeof deleted !== "boolean" ||
    typeof latestVersion !== "bigint" ||
    typeof lastUpdatedAt !== "bigint"
  ) {
    return undefined;
  }

  return {
    id,
    author: author as Address,
    ipfsHash,
    title,
    description,
    voteCount,
    timestamp,
    rewardAccrued,
    deleted,
    latestVersion,
    lastUpdatedAt,
  };
}

/**
 * @notice 将未知值解析为内容版本结构。
 * @param value 合约返回的原始版本元组。
 * @param version 当前版本号。
 * @returns 解析后的版本对象；若结构不匹配则返回 `undefined`。
 */
export function asContentVersion(
  value: unknown,
  version: bigint
): ContentVersionData | undefined {
  if (!Array.isArray(value) || value.length < 4) return undefined;

  const [ipfsHash, title, description, timestamp] = value as readonly unknown[];

  if (
    typeof ipfsHash !== "string" ||
    typeof title !== "string" ||
    typeof description !== "string" ||
    typeof timestamp !== "bigint"
  ) {
    return undefined;
  }

  return {
    version,
    ipfsHash,
    title,
    description,
    timestamp,
  };
}
