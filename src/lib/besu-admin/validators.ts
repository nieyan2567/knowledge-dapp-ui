import "server-only";

import {
  callValidatorRpc,
  getValidatorRpcUrls,
} from "@/lib/besu-admin/client";

export async function getValidators() {
  const [firstUrl] = getValidatorRpcUrls();

  if (!firstUrl) {
    throw new Error("No validator RPC URLs configured");
  }

  return callValidatorRpc<string[]>(
    firstUrl,
    "qbft_getValidatorsByBlockNumber",
    ["latest"]
  );
}

export async function proposeValidatorVoteAcrossValidators(
  validatorAddress: `0x${string}`,
  add = true
) {
  const urls = getValidatorRpcUrls();

  if (urls.length === 0) {
    throw new Error("No validator RPC URLs configured");
  }

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const result = await callValidatorRpc<boolean>(
          url,
          "qbft_proposeValidatorVote",
          [validatorAddress, add]
        );

        return { url, ok: true as const, result };
      } catch (error) {
        return {
          url,
          ok: false as const,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    })
  );

  const successCount = results.filter((entry) => entry.ok).length;

  return {
    urls,
    successCount,
    results,
  };
}
