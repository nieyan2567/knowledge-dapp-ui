import type { Page, Route } from "@playwright/test";

const CHAIN_ID = 20260;
const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;
const RPC_URL = process.env.NEXT_PUBLIC_BESU_RPC_URL ?? "http://127.0.0.1:8545";
const ZERO_WORD = `0x${"0".repeat(64)}`;
const ZERO_ADDRESS_WORD = `0x${"0".repeat(24)}${"0".repeat(40)}`;
const EMPTY_TX_HASH = `0x${"1".repeat(64)}`;

type JsonRpcRequest = {
  id?: string | number | null;
  method?: string;
  params?: unknown[];
};

function json(value: unknown) {
  return JSON.stringify(value);
}

function jsonRpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result,
  };
}

function createBlock(numberHex: string) {
  return {
    number: numberHex,
    hash: `0x${"a".repeat(64)}`,
    parentHash: `0x${"b".repeat(64)}`,
    nonce: "0x0000000000000000",
    sha3Uncles: `0x${"c".repeat(64)}`,
    logsBloom: `0x${"0".repeat(512)}`,
    transactionsRoot: `0x${"d".repeat(64)}`,
    stateRoot: `0x${"e".repeat(64)}`,
    receiptsRoot: `0x${"f".repeat(64)}`,
    miner: `0x${"0".repeat(40)}`,
    difficulty: "0x0",
    totalDifficulty: "0x0",
    extraData: "0x",
    size: "0x0",
    gasLimit: "0x1c9c380",
    gasUsed: "0x0",
    timestamp: "0x65f2d5c0",
    transactions: [],
    uncles: [],
    baseFeePerGas: "0x0",
    mixHash: `0x${"1".repeat(64)}`,
    withdrawals: [],
    withdrawalsRoot: `0x${"2".repeat(64)}`,
    blobGasUsed: "0x0",
    excessBlobGas: "0x0",
    parentBeaconBlockRoot: `0x${"3".repeat(64)}`,
  };
}

function resolveRpcResult(request: JsonRpcRequest) {
  switch (request.method) {
    case "eth_chainId":
      return CHAIN_ID_HEX;
    case "net_version":
      return String(CHAIN_ID);
    case "eth_blockNumber":
      return "0x10";
    case "eth_getBalance":
      return "0x0";
    case "eth_call":
      return ZERO_WORD;
    case "eth_getLogs":
      return [];
    case "eth_getBlockByNumber": {
      const requestedBlock =
        typeof request.params?.[0] === "string" ? request.params[0] : "0x10";
      return createBlock(requestedBlock);
    }
    case "eth_getCode":
      return "0x";
    case "eth_estimateGas":
      return "0x5208";
    case "eth_gasPrice":
    case "eth_maxPriorityFeePerGas":
      return "0x0";
    case "eth_sendTransaction":
    case "eth_sendRawTransaction":
      return EMPTY_TX_HASH;
    case "eth_accounts":
    case "eth_requestAccounts":
      return [];
    case "wallet_getCapabilities":
      return {};
    default:
      return ZERO_ADDRESS_WORD;
  }
}

async function fulfillJsonRpc(route: Route, payload: JsonRpcRequest | JsonRpcRequest[]) {
  const body = Array.isArray(payload)
    ? payload.map((request) => jsonRpcResult(request.id, resolveRpcResult(request)))
    : jsonRpcResult(payload.id, resolveRpcResult(payload));

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: json(body),
  });
}

export async function mockKnowChainRpc(page: Page) {
  await page.route(RPC_URL, async (route) => {
    const request = route.request();

    if (request.method() !== "POST") {
      await route.fulfill({ status: 200, body: "" });
      return;
    }

    const payload = request.postDataJSON() as JsonRpcRequest | JsonRpcRequest[];
    await fulfillJsonRpc(route, payload);
  });
}
