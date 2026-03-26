import type { Address, HexString } from "@/types/contracts";
import type { ContentData } from "@/types/content";
import type { ProposalVotes } from "@/types/governance";

export function asBigInt(value: unknown): bigint | undefined {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }

  return undefined;
}

export function asAddress(value: unknown): Address | undefined {
  return typeof value === "string" && value.startsWith("0x")
    ? (value as Address)
    : undefined;
}

export function asHex(value: unknown): HexString | undefined {
  return typeof value === "string" && value.startsWith("0x")
    ? (value as HexString)
    : undefined;
}

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

export function asContentData(value: unknown): ContentData | undefined {
  if (!Array.isArray(value) || value.length < 9) return undefined;

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
    typeof deleted !== "boolean"
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
  };
}
