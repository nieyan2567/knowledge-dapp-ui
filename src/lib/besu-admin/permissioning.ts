import "server-only";

import { callPermissioningRpc } from "@/lib/besu-admin/client";

export async function getNodesAllowlist() {
  return callPermissioningRpc<string[]>("perm_getNodesAllowlist");
}

export async function addNodeToAllowlist(enode: string) {
  return callPermissioningRpc<boolean>("perm_addNodesToAllowlist", [[enode]]);
}

export async function removeNodeFromAllowlist(enode: string) {
  return callPermissioningRpc<boolean>("perm_removeNodesFromAllowlist", [[enode]]);
}
