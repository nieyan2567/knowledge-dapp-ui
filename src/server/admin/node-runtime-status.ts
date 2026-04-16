/**
 * @file 节点运行时状态模块。
 * @description 负责检查节点申请对应的 RPC 可达性、同步状态和 Besu allowlist 状态。
 */
import "server-only";

import type {
  NodeRequestRecord,
  NodeRequestRuntimeStatus,
  NodeRuntimeHealthStage,
} from "@/lib/admin/types";
import { getNodesAllowlist } from "@/lib/besu-admin/permissioning";
import { BesuAdminRpcError } from "@/lib/besu-admin/client";

type JsonRpcSuccess<T> = {
  jsonrpc: "2.0";
  id: number;
  result: T;
};

type JsonRpcError = {
  jsonrpc: "2.0";
  id: number | null;
  error: {
    code: number;
    message: string;
  };
};

type EthSyncingResult =
  | false
  | {
      currentBlock?: string;
      highestBlock?: string;
      startingBlock?: string;
    };

type NodeHealthSnapshot = {
  stage: NodeRuntimeHealthStage;
  detail: string;
  peerCount: number | null;
  currentBlock: string | null;
  highestBlock: string | null;
  nodeEnode: string | null;
};

type NodeInfoResult = {
  enode?: string;
};

function normalizeEnode(value: string) {
  return value.trim().toLowerCase();
}

async function callNodeRpc<TResult>(
  rpcUrl: string,
  method: string,
  params: unknown[] = []
): Promise<TResult> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as
    | JsonRpcSuccess<TResult>
    | JsonRpcError;

  if ("error" in payload) {
    throw new Error(payload.error.message);
  }

  return payload.result;
}

async function readNodeHealth(
  request: NodeRequestRecord
): Promise<NodeHealthSnapshot> {
  if (!request.nodeRpcUrl) {
    return {
      stage: "not_configured",
      detail: "No node RPC URL was provided with the request.",
      peerCount: null,
      currentBlock: null,
      highestBlock: null,
      nodeEnode: null,
    };
  }

  try {
    // 并行拉取节点核心健康指标，尽量在一次检查里拿到 peer、同步和 enode 信息。
    const [peerCountHex, syncing, blockNumber, nodeInfo] = await Promise.all([
      callNodeRpc<string>(request.nodeRpcUrl, "net_peerCount"),
      callNodeRpc<EthSyncingResult>(request.nodeRpcUrl, "eth_syncing"),
      callNodeRpc<string>(request.nodeRpcUrl, "eth_blockNumber"),
      callNodeRpc<NodeInfoResult>(request.nodeRpcUrl, "admin_nodeInfo").catch(
        (): NodeInfoResult => ({})
      ),
    ]);

    const peerCount = Number.parseInt(peerCountHex, 16);
    const currentBlock = typeof blockNumber === "string" ? blockNumber : null;
    const highestBlock =
      syncing && typeof syncing === "object" && typeof syncing.highestBlock === "string"
        ? syncing.highestBlock
        : currentBlock;
    const nodeEnode = typeof nodeInfo.enode === "string" ? nodeInfo.enode : null;

    if (nodeEnode && normalizeEnode(nodeEnode) !== normalizeEnode(request.enode)) {
      return {
        stage: "enode_mismatch",
        detail: "The node RPC reports a different enode than the request record.",
        peerCount: Number.isFinite(peerCount) ? peerCount : null,
        currentBlock,
        highestBlock,
        nodeEnode,
      };
    }

    if (syncing && typeof syncing === "object") {
      return {
        stage: "syncing",
        detail: "The node is reachable and is still syncing the chain.",
        peerCount: Number.isFinite(peerCount) ? peerCount : null,
        currentBlock:
          typeof syncing.currentBlock === "string" ? syncing.currentBlock : currentBlock,
        highestBlock,
        nodeEnode,
      };
    }

    if (!Number.isFinite(peerCount) || peerCount <= 0) {
      return {
        stage: "waiting_for_peers",
        detail: "The node RPC is reachable, but the node has not connected to peers yet.",
        peerCount: Number.isFinite(peerCount) ? peerCount : 0,
        currentBlock,
        highestBlock,
        nodeEnode,
      };
    }

    return {
      stage: "healthy",
      detail: "The node is reachable, connected to peers, and not syncing.",
      peerCount,
      currentBlock,
      highestBlock,
      nodeEnode,
    };
  } catch (error) {
    return {
      stage: "unreachable",
      detail:
        error instanceof Error
          ? `Node RPC check failed: ${error.message}`
          : "Node RPC check failed.",
      peerCount: null,
      currentBlock: null,
      highestBlock: null,
      nodeEnode: null,
    };
  }
}

/**
 * @notice 获取节点申请的运行时状态快照。
 * @param request 节点申请记录。
 * @returns 包含 allowlist 状态、检查时间和节点健康信息的运行时状态对象。
 */
export async function getNodeRequestRuntimeStatus(
  request: NodeRequestRecord
): Promise<NodeRequestRuntimeStatus> {
  let allowlist: string[] | null = null;
  let allowlistError: string | null = null;

  try {
    allowlist = await getNodesAllowlist();
  } catch (error) {
    allowlistError =
      error instanceof BesuAdminRpcError ? error.message : "白名单加载失败";
  }

  const isAllowlisted = !!allowlist?.some(
    (entry) => normalizeEnode(entry) === normalizeEnode(request.enode)
  );
  const health = await readNodeHealth(request);

  return {
    requestId: request.id,
    checkedAt: new Date().toISOString(),
    isAllowlisted,
    allowlistError,
    health,
  };
}
