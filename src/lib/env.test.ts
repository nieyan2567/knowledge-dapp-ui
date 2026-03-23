import { afterEach, describe, expect, it } from "vitest";

import { getPublicEnv, getServerEnv } from "./env";

const mutableEnv = process.env as Record<string, string | undefined>;

const originalEnv = {
  NODE_ENV: process.env["NODE_ENV"],
  NEXT_PUBLIC_BESU_RPC_URL: process.env["NEXT_PUBLIC_BESU_RPC_URL"],
  NEXT_PUBLIC_BESU_CHAIN_ID: process.env["NEXT_PUBLIC_BESU_CHAIN_ID"],
  NEXT_PUBLIC_CHAINLENS_URL: process.env["NEXT_PUBLIC_CHAINLENS_URL"],
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
    process.env["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"],
  NEXT_PUBLIC_IPFS_GATEWAY_URL: process.env["NEXT_PUBLIC_IPFS_GATEWAY_URL"],
  UPLOAD_AUTH_SECRET: process.env["UPLOAD_AUTH_SECRET"],
  API_RATE_LIMIT_MAX: process.env["API_RATE_LIMIT_MAX"],
  REDIS_URL: process.env["REDIS_URL"],
  FAUCET_PRIVATE_KEY: process.env["FAUCET_PRIVATE_KEY"],
};

function restoreEnvValue(name: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  mutableEnv[name] = value;
}

function applyValidServerEnv() {
  mutableEnv.NODE_ENV = "test";
  mutableEnv.NEXT_PUBLIC_BESU_RPC_URL = "http://127.0.0.1:8545";
  mutableEnv.NEXT_PUBLIC_BESU_CHAIN_ID = "20260";
  mutableEnv.NEXT_PUBLIC_CHAINLENS_URL = "http://127.0.0.1:8181";
  mutableEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = "";
  mutableEnv.NEXT_PUBLIC_IPFS_GATEWAY_URL = "http://127.0.0.1:8080/ipfs";
  mutableEnv.UPLOAD_AUTH_SECRET = "test-upload-secret";
  mutableEnv.API_RATE_LIMIT_MAX = "120";
  mutableEnv.REDIS_URL = "redis://localhost:6379";
  mutableEnv.FAUCET_PRIVATE_KEY = `0x${"1".repeat(64)}`;
}

afterEach(() => {
  restoreEnvValue("NODE_ENV", originalEnv.NODE_ENV);
  restoreEnvValue("NEXT_PUBLIC_BESU_RPC_URL", originalEnv.NEXT_PUBLIC_BESU_RPC_URL);
  restoreEnvValue("NEXT_PUBLIC_BESU_CHAIN_ID", originalEnv.NEXT_PUBLIC_BESU_CHAIN_ID);
  restoreEnvValue("NEXT_PUBLIC_CHAINLENS_URL", originalEnv.NEXT_PUBLIC_CHAINLENS_URL);
  restoreEnvValue(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
    originalEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  );
  restoreEnvValue("NEXT_PUBLIC_IPFS_GATEWAY_URL", originalEnv.NEXT_PUBLIC_IPFS_GATEWAY_URL);
  restoreEnvValue("UPLOAD_AUTH_SECRET", originalEnv.UPLOAD_AUTH_SECRET);
  restoreEnvValue("API_RATE_LIMIT_MAX", originalEnv.API_RATE_LIMIT_MAX);
  restoreEnvValue("REDIS_URL", originalEnv.REDIS_URL);
  restoreEnvValue("FAUCET_PRIVATE_KEY", originalEnv.FAUCET_PRIVATE_KEY);
});

describe("env", () => {
  it("applies defaults for public variables", () => {
    delete process.env.NEXT_PUBLIC_BESU_RPC_URL;
    delete process.env.NEXT_PUBLIC_BESU_CHAIN_ID;
    delete process.env.NEXT_PUBLIC_CHAINLENS_URL;
    delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL;

    expect(getPublicEnv()).toMatchObject({
      NEXT_PUBLIC_BESU_RPC_URL: "http://127.0.0.1:8545",
      NEXT_PUBLIC_BESU_CHAIN_ID: 20260,
      NEXT_PUBLIC_CHAINLENS_URL: "http://127.0.0.1:8181",
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "",
      NEXT_PUBLIC_IPFS_GATEWAY_URL: "http://127.0.0.1:8080/ipfs",
    });
  });

  it("treats blank optional server values as undefined", () => {
    applyValidServerEnv();
    mutableEnv.REDIS_URL = "";

    expect(getServerEnv().REDIS_URL).toBeUndefined();
  });

  it("rejects invalid numeric values", () => {
    applyValidServerEnv();
    mutableEnv.API_RATE_LIMIT_MAX = "0";

    expect(() => getServerEnv()).toThrow(/API_RATE_LIMIT_MAX/i);
  });

  it("requires upload auth secret in production", () => {
    applyValidServerEnv();
    mutableEnv.NODE_ENV = "production";
    delete process.env.UPLOAD_AUTH_SECRET;

    expect(() => getServerEnv()).toThrow(/UPLOAD_AUTH_SECRET/i);
  });

  it("validates faucet private key format when configured", () => {
    applyValidServerEnv();
    mutableEnv.FAUCET_PRIVATE_KEY = "not-a-private-key";

    expect(() => getServerEnv()).toThrow(/FAUCET_PRIVATE_KEY/i);
  });
});
