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
  IPFS_API_URL: process.env["IPFS_API_URL"],
  IPFS_GATEWAY_URL: process.env["IPFS_GATEWAY_URL"],
  API_RATE_LIMIT_MAX: process.env["API_RATE_LIMIT_MAX"],
  REDIS_URL: process.env["REDIS_URL"],
  OBS_SERVICE_NAME: process.env["OBS_SERVICE_NAME"],
  OBS_DEPLOYMENT_ENV: process.env["OBS_DEPLOYMENT_ENV"],
  OBS_LOG_LEVEL: process.env["OBS_LOG_LEVEL"],
  OBS_ALERT_WEBHOOK_URL: process.env["OBS_ALERT_WEBHOOK_URL"],
  OBS_ALERT_MIN_SEVERITY: process.env["OBS_ALERT_MIN_SEVERITY"],
  OBS_ALERT_DEDUP_WINDOW_SECONDS: process.env["OBS_ALERT_DEDUP_WINDOW_SECONDS"],
  OBS_CLIENT_ERROR_SAMPLE_RATE: process.env["OBS_CLIENT_ERROR_SAMPLE_RATE"],
  FAUCET_PRIVATE_KEY: process.env["FAUCET_PRIVATE_KEY"],
  REBALANCE_API_TOKEN: process.env["REBALANCE_API_TOKEN"],
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
  mutableEnv.IPFS_API_URL = "http://127.0.0.1:5001";
  mutableEnv.IPFS_GATEWAY_URL = "http://127.0.0.1:8080/ipfs";
  mutableEnv.API_RATE_LIMIT_MAX = "120";
  mutableEnv.REDIS_URL = "redis://localhost:6379";
  mutableEnv.OBS_SERVICE_NAME = "knowledge-dapp-ui";
  mutableEnv.OBS_DEPLOYMENT_ENV = "test";
  mutableEnv.OBS_LOG_LEVEL = "info";
  mutableEnv.OBS_ALERT_WEBHOOK_URL = "https://alerts.example.com/webhook";
  mutableEnv.OBS_ALERT_MIN_SEVERITY = "error";
  mutableEnv.OBS_ALERT_DEDUP_WINDOW_SECONDS = "300";
  mutableEnv.OBS_CLIENT_ERROR_SAMPLE_RATE = "1";
  mutableEnv.FAUCET_PRIVATE_KEY = `0x${"1".repeat(64)}`;
  mutableEnv.REBALANCE_API_TOKEN = "rebalance-secret";
}

function applyValidProductionUrls() {
  mutableEnv.NEXT_PUBLIC_BESU_RPC_URL = "https://rpc.example.com";
  mutableEnv.NEXT_PUBLIC_CHAINLENS_URL = "https://scan.example.com";
  mutableEnv.NEXT_PUBLIC_IPFS_GATEWAY_URL = "https://ipfs.example.com/ipfs";
  mutableEnv.IPFS_API_URL = "https://ipfs-api.example.com";
  mutableEnv.IPFS_GATEWAY_URL = "https://ipfs.example.com/ipfs";
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
  restoreEnvValue("IPFS_API_URL", originalEnv.IPFS_API_URL);
  restoreEnvValue("IPFS_GATEWAY_URL", originalEnv.IPFS_GATEWAY_URL);
  restoreEnvValue("API_RATE_LIMIT_MAX", originalEnv.API_RATE_LIMIT_MAX);
  restoreEnvValue("REDIS_URL", originalEnv.REDIS_URL);
  restoreEnvValue("OBS_SERVICE_NAME", originalEnv.OBS_SERVICE_NAME);
  restoreEnvValue("OBS_DEPLOYMENT_ENV", originalEnv.OBS_DEPLOYMENT_ENV);
  restoreEnvValue("OBS_LOG_LEVEL", originalEnv.OBS_LOG_LEVEL);
  restoreEnvValue("OBS_ALERT_WEBHOOK_URL", originalEnv.OBS_ALERT_WEBHOOK_URL);
  restoreEnvValue("OBS_ALERT_MIN_SEVERITY", originalEnv.OBS_ALERT_MIN_SEVERITY);
  restoreEnvValue(
    "OBS_ALERT_DEDUP_WINDOW_SECONDS",
    originalEnv.OBS_ALERT_DEDUP_WINDOW_SECONDS
  );
  restoreEnvValue(
    "OBS_CLIENT_ERROR_SAMPLE_RATE",
    originalEnv.OBS_CLIENT_ERROR_SAMPLE_RATE
  );
  restoreEnvValue("FAUCET_PRIVATE_KEY", originalEnv.FAUCET_PRIVATE_KEY);
  restoreEnvValue("REBALANCE_API_TOKEN", originalEnv.REBALANCE_API_TOKEN);
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
    applyValidProductionUrls();
    mutableEnv.NODE_ENV = "production";
    delete process.env.UPLOAD_AUTH_SECRET;

    expect(() => getServerEnv()).toThrow(/UPLOAD_AUTH_SECRET/i);
  });

  it("requires explicit public URLs in production", () => {
    applyValidServerEnv();
    applyValidProductionUrls();
    mutableEnv.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_BESU_RPC_URL;

    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_BESU_RPC_URL/i);
  });

  it("rejects localhost public URLs in production", () => {
    applyValidServerEnv();
    mutableEnv.NODE_ENV = "production";

    expect(() => getPublicEnv()).toThrow(/Must not point to localhost/i);
  });

  it("requires explicit server URLs in production", () => {
    applyValidServerEnv();
    applyValidProductionUrls();
    mutableEnv.NODE_ENV = "production";
    delete process.env.IPFS_API_URL;

    expect(() => getServerEnv()).toThrow(/IPFS_API_URL/i);
  });

  it("rejects localhost server URLs in production", () => {
    applyValidServerEnv();
    mutableEnv.NODE_ENV = "production";

    expect(() => getServerEnv()).toThrow(/IPFS_API_URL|Must not point to localhost/i);
  });

  it("requires an alert webhook in production", () => {
    applyValidServerEnv();
    applyValidProductionUrls();
    mutableEnv.NODE_ENV = "production";
    delete process.env.OBS_ALERT_WEBHOOK_URL;

    expect(() => getServerEnv()).toThrow(/OBS_ALERT_WEBHOOK_URL/i);
  });

  it("validates faucet private key format when configured", () => {
    applyValidServerEnv();
    mutableEnv.FAUCET_PRIVATE_KEY = "not-a-private-key";

    expect(() => getServerEnv()).toThrow(/FAUCET_PRIVATE_KEY/i);
  });

  it("treats blank rebalance api token as undefined", () => {
    applyValidServerEnv();
    mutableEnv.REBALANCE_API_TOKEN = "";

    expect(getServerEnv().REBALANCE_API_TOKEN).toBeUndefined();
  });
});
