/**
 * @notice Besu 验证者管理封装。
 * @dev 提供读取指定区块验证者列表和发起验证者投票的能力。
 */
import "server-only";

import { callBesuAdminRpc } from "@/lib/besu-admin/client";

/**
 * @notice 读取指定区块高度下的验证者列表。
 * @param blockNumber 目标区块号或 Besu 支持的特殊区块标签，默认值为 `latest`。
 * @returns 该区块对应的验证者地址数组。
 */
export async function getValidatorsByBlockNumber(
  blockNumber: "latest" | "pending" | "earliest" | string = "latest"
) {
  return callBesuAdminRpc<`0x${string}`[]>("qbft_getValidatorsByBlockNumber", [
    blockNumber,
  ]);
}

/**
 * @notice 发起验证者增删投票。
 * @param validatorAddress 目标验证者地址。
 * @param add 是否将该地址加入验证者集合；`false` 表示发起移除投票。
 * @returns Besu RPC 调用结果。
 */
export async function proposeValidatorVote(
  validatorAddress: `0x${string}`,
  add: boolean
) {
  return callBesuAdminRpc<unknown>("qbft_proposeValidatorVote", [
    validatorAddress,
    add,
  ]);
}
