/**
 * @notice `faucet/utils` 聚合入口测试。
 * @dev 覆盖默认锁 TTL、请求上下文哈希和 Faucet 错误识别逻辑。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  FaucetInfraError,
  createRequestContextHashes,
  getFaucetLockTtlSeconds,
  getRequestUserAgent,
  isFaucetError,
} from "./utils";

const originalLockTtl = process.env.FAUCET_LOCK_TTL_SECONDS;

beforeEach(() => {
  delete process.env.FAUCET_LOCK_TTL_SECONDS;
});

afterEach(() => {
  process.env.FAUCET_LOCK_TTL_SECONDS = originalLockTtl;
});

describe("faucet/utils", () => {
  it("uses a short default lock ttl", () => {
    expect(getFaucetLockTtlSeconds()).toBe(60);
  });

  it("builds stable request context hashes", () => {
    const first = createRequestContextHashes({
      address: "0x1111111111111111111111111111111111111111",
      ip: "127.0.0.1",
      userAgent: "Vitest UA",
    });
    const second = createRequestContextHashes({
      address: "0x1111111111111111111111111111111111111111",
      ip: "127.0.0.1",
      userAgent: "Vitest UA",
    });

    expect(second).toEqual(first);
    expect(first.ipHash).not.toBe("127.0.0.1");
    expect(first.userAgentHash).not.toBe("Vitest UA");
  });

  it("returns a fallback user agent when the header is missing", () => {
    const headers = new Headers();

    expect(getRequestUserAgent(headers)).toBe("unknown");
  });

  it("identifies faucet infrastructure errors", () => {
    expect(isFaucetError(new FaucetInfraError())).toBe(true);
    expect(isFaucetError(new Error("boom"))).toBe(false);
  });
});
