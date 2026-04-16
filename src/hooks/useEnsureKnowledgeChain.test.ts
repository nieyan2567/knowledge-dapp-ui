/**
 * @notice `useEnsureKnowledgeChain` 相关辅助函数测试。
 * @dev 当前测试聚焦于链注册参数构造和未知链错误识别逻辑，避免切链基础能力回归。
 */
import { describe, expect, it } from "vitest";

import { buildAddEthereumChainParams, isUnknownChainError } from "@/hooks/useEnsureKnowledgeChain";
import { getKnowledgeChain } from "@/lib/chains";

describe("useEnsureKnowledgeChain helpers", () => {
  it("builds wallet_addEthereumChain params from the configured chain", () => {
    const chain = getKnowledgeChain();
    const params = buildAddEthereumChainParams(chain);

    expect(params).toEqual({
      chainId: `0x${chain.id.toString(16)}`,
      chainName: chain.name,
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: chain.rpcUrls.default.http,
      blockExplorerUrls: [chain.blockExplorers.default.url],
    });
  });

  it("detects the standard unknown-chain error code", () => {
    expect(isUnknownChainError({ code: 4902 })).toBe(true);
    expect(isUnknownChainError({ cause: { code: 4902 } })).toBe(true);
  });

  it("detects unknown-chain errors from wallet messages", () => {
    expect(isUnknownChainError(new Error("Unrecognized chain ID"))).toBe(true);
    expect(isUnknownChainError({ shortMessage: "Chain not added to wallet" })).toBe(true);
  });

  it("does not classify unrelated wallet errors as unknown-chain", () => {
    expect(isUnknownChainError(new Error("User rejected the request."))).toBe(false);
    expect(isUnknownChainError({ code: 4001 })).toBe(false);
    expect(isUnknownChainError(null)).toBe(false);
  });
});
