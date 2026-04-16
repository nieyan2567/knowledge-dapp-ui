/**
 * @notice Besu 允许列表管理封装。
 * @dev 提供节点 allowlist 的读取、添加和移除能力，供管理端服务调用。
 */
import "server-only";

import { callBesuAdminRpc } from "@/lib/besu-admin/client";

/**
 * @notice 读取当前 Besu 网络的节点 allowlist。
 * @returns 当前允许接入网络的 enode 列表。
 */
export async function getNodesAllowlist() {
  return callBesuAdminRpc<string[]>("perm_getNodesAllowlist");
}

/**
 * @notice 向 Besu 节点 allowlist 中新增节点。
 * @param enodes 需要加入 allowlist 的 enode 地址列表。
 * @returns Besu RPC 调用结果。
 */
export async function addNodesToAllowlist(enodes: string[]) {
  return callBesuAdminRpc<unknown>("perm_addNodesToAllowlist", [enodes]);
}

/**
 * @notice 从 Besu 节点 allowlist 中移除节点。
 * @param enodes 需要移除的 enode 地址列表。
 * @returns Besu RPC 调用结果。
 */
export async function removeNodesFromAllowlist(enodes: string[]) {
  return callBesuAdminRpc<unknown>("perm_removeNodesFromAllowlist", [enodes]);
}
