import "server-only";

import { callBesuAdminRpc } from "@/lib/besu-admin/client";

export async function getValidatorsByBlockNumber(
  blockNumber: "latest" | "pending" | "earliest" | string = "latest"
) {
  return callBesuAdminRpc<`0x${string}`[]>("qbft_getValidatorsByBlockNumber", [
    blockNumber,
  ]);
}

export async function proposeValidatorVote(
  validatorAddress: `0x${string}`,
  add: boolean
) {
  return callBesuAdminRpc<unknown>("qbft_proposeValidatorVote", [
    validatorAddress,
    add,
  ]);
}
