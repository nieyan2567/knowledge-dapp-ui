import "server-only";

import { callBesuAdminRpc } from "@/lib/besu-admin/client";

export async function getNodesAllowlist() {
  return callBesuAdminRpc<string[]>("perm_getNodesAllowlist");
}

export async function addNodesToAllowlist(enodes: string[]) {
  return callBesuAdminRpc<unknown>("perm_addNodesToAllowlist", [enodes]);
}

export async function removeNodesFromAllowlist(enodes: string[]) {
  return callBesuAdminRpc<unknown>("perm_removeNodesFromAllowlist", [enodes]);
}
