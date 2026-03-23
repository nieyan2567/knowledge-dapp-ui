import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetApiRateLimitStoreForTests,
  enforceApiRateLimits,
} from "./api-rate-limit";

const originalRedisUrl = process.env.REDIS_URL;
const originalApiRateLimitMax = process.env.API_RATE_LIMIT_MAX;
const originalApiRateLimitWindowSeconds =
  process.env.API_RATE_LIMIT_WINDOW_SECONDS;

beforeEach(() => {
  process.env.REDIS_URL = "";
  process.env.API_RATE_LIMIT_MAX = "2";
  process.env.API_RATE_LIMIT_WINDOW_SECONDS = "60";
  __resetApiRateLimitStoreForTests();
});

afterEach(() => {
  process.env.REDIS_URL = originalRedisUrl;
  process.env.API_RATE_LIMIT_MAX = originalApiRateLimitMax;
  process.env.API_RATE_LIMIT_WINDOW_SECONDS = originalApiRateLimitWindowSeconds;
  __resetApiRateLimitStoreForTests();
  vi.useRealTimers();
});

describe("api-rate-limit", () => {
  it("applies the global limit with memory fallback", async () => {
    const headers = new Headers({
      "x-forwarded-for": "127.0.0.1",
    });

    expect(await enforceApiRateLimits(headers, [])).toEqual({ ok: true });
    expect(await enforceApiRateLimits(headers, [])).toEqual({ ok: true });

    const blocked = await enforceApiRateLimits(headers, []);

    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(429);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("stacks route-specific limits on top of the global limit", async () => {
    process.env.API_RATE_LIMIT_MAX = "100";
    const headers = new Headers({
      "x-forwarded-for": "10.0.0.1",
    });

    for (let index = 0; index < 10; index += 1) {
      expect(await enforceApiRateLimits(headers, ["ipfs:upload"])).toEqual({
        ok: true,
      });
    }

    const blocked = await enforceApiRateLimits(headers, ["ipfs:upload"]);
    expect(blocked.ok).toBe(false);
  });

  it("expires counters after the window passes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T00:00:00.000Z"));
    process.env.API_RATE_LIMIT_MAX = "1";
    process.env.API_RATE_LIMIT_WINDOW_SECONDS = "1";

    const headers = new Headers({
      "x-forwarded-for": "192.168.0.1",
    });

    expect(await enforceApiRateLimits(headers, [])).toEqual({ ok: true });
    expect((await enforceApiRateLimits(headers, [])).ok).toBe(false);

    vi.advanceTimersByTime(1100);

    expect(await enforceApiRateLimits(headers, [])).toEqual({ ok: true });
  });
});
