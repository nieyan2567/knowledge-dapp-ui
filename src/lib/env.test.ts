import { afterEach, describe, expect, it, vi } from "vitest";

import { getPublicEnv, getPublicRuntimeEnv, getServerEnv } from "./env";

const mutableEnv = process.env as Record<string, string | undefined>;

const originalEnv = {
  NODE_ENV: process.env["NODE_ENV"],
  NEXT_PUBLIC_BESU_RPC_URL: process.env["NEXT_PUBLIC_BESU_RPC_URL"],
  NEXT_PUBLIC_BESU_CHAIN_ID: process.env["NEXT_PUBLIC_BESU_CHAIN_ID"],
  NEXT_PUBLIC_BLOCKSCOUT_URL: process.env["NEXT_PUBLIC_BLOCKSCOUT_URL"],
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
    process.env["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"],
  NEXT_PUBLIC_IPFS_GATEWAY_URL: process.env["NEXT_PUBLIC_IPFS_GATEWAY_URL"],
  UPLOAD_AUTH_SECRET: process.env["UPLOAD_AUTH_SECRET"],
  IPFS_API_URL: process.env["IPFS_API_URL"],
  IPFS_GATEWAY_URL: process.env["IPFS_GATEWAY_URL"],
  DATABASE_URL: process.env["DATABASE_URL"],
  API_RATE_LIMIT_MAX: process.env["API_RATE_LIMIT_MAX"],
  REDIS_URL: process.env["REDIS_URL"],
  BESU_ADMIN_RPC_URL: process.env["BESU_ADMIN_RPC_URL"],
  BESU_ADMIN_RPC_TOKEN: process.env["BESU_ADMIN_RPC_TOKEN"],
  ADMIN_ADDRESSES: process.env["ADMIN_ADDRESSES"],
  OBS_SERVICE_NAME: process.env["OBS_SERVICE_NAME"],
  OBS_DEPLOYMENT_ENV: process.env["OBS_DEPLOYMENT_ENV"],
  OBS_LOG_LEVEL: process.env["OBS_LOG_LEVEL"],
  OBS_ALERT_WEBHOOK_URL: process.env["OBS_ALERT_WEBHOOK_URL"],
  OBS_ALERT_MIN_SEVERITY: process.env["OBS_ALERT_MIN_SEVERITY"],
  OBS_ALERT_DEDUP_WINDOW_SECONDS: process.env["OBS_ALERT_DEDUP_WINDOW_SECONDS"],
  OBS_CLIENT_ERROR_SAMPLE_RATE: process.env["OBS_CLIENT_ERROR_SAMPLE_RATE"],
  FAUCET_AUTH_SIGNER_PRIVATE_KEY:
    process.env["FAUCET_AUTH_SIGNER_PRIVATE_KEY"],
  FAUCET_RELAYER_PRIVATE_KEY: process.env["FAUCET_RELAYER_PRIVATE_KEY"],
  FAUCET_TOP_UP_FUNDER_PRIVATE_KEY:
    process.env["FAUCET_TOP_UP_FUNDER_PRIVATE_KEY"],
  SYSTEM_API_TOKEN: process.env["SYSTEM_API_TOKEN"],
  REBALANCE_API_TOKEN: process.env["REBALANCE_API_TOKEN"],
  FAUCET_RELAYER_ALERT_MIN_BALANCE:
    process.env["FAUCET_RELAYER_ALERT_MIN_BALANCE"],
  FAUCET_RELAYER_TOP_UP_AMOUNT: process.env["FAUCET_RELAYER_TOP_UP_AMOUNT"],
  FAUCET_VAULT_ALERT_MIN_BALANCE:
    process.env["FAUCET_VAULT_ALERT_MIN_BALANCE"],
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
  mutableEnv.NEXT_PUBLIC_BLOCKSCOUT_URL = "http://127.0.0.1:8182";
  mutableEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = "";
  mutableEnv.NEXT_PUBLIC_IPFS_GATEWAY_URL = "http://127.0.0.1:8080/ipfs";
  mutableEnv.UPLOAD_AUTH_SECRET = "test-upload-secret";
  mutableEnv.IPFS_API_URL = "http://127.0.0.1:5001";
  mutableEnv.IPFS_GATEWAY_URL = "http://127.0.0.1:8080/ipfs";
  mutableEnv.DATABASE_URL = "postgresql://knowledge:knowledge@127.0.0.1:5432/knowledge_dapp";
  mutableEnv.API_RATE_LIMIT_MAX = "120";
  mutableEnv.REDIS_URL = "redis://localhost:6379";
  mutableEnv.BESU_ADMIN_RPC_URL = "http://127.0.0.1:8545";
  mutableEnv.BESU_ADMIN_RPC_TOKEN = "besu-admin-secret";
  mutableEnv.ADMIN_ADDRESSES =
    "0x1234567890abcdef1234567890abcdef12345678,0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
  mutableEnv.OBS_SERVICE_NAME = "knowledge-dapp-ui";
  mutableEnv.OBS_DEPLOYMENT_ENV = "test";
  mutableEnv.OBS_LOG_LEVEL = "info";
  mutableEnv.OBS_ALERT_WEBHOOK_URL = "https://alerts.example.com/webhook";
  mutableEnv.OBS_ALERT_MIN_SEVERITY = "error";
  mutableEnv.OBS_ALERT_DEDUP_WINDOW_SECONDS = "300";
  mutableEnv.OBS_CLIENT_ERROR_SAMPLE_RATE = "1";
  mutableEnv.FAUCET_AUTH_SIGNER_PRIVATE_KEY = `0x${"2".repeat(64)}`;
  mutableEnv.FAUCET_RELAYER_PRIVATE_KEY = `0x${"3".repeat(64)}`;
  mutableEnv.FAUCET_TOP_UP_FUNDER_PRIVATE_KEY = `0x${"4".repeat(64)}`;
  mutableEnv.SYSTEM_API_TOKEN = "system-secret";
  mutableEnv.REBALANCE_API_TOKEN = "rebalance-secret";
  mutableEnv.FAUCET_RELAYER_ALERT_MIN_BALANCE = "0.05";
  mutableEnv.FAUCET_RELAYER_TOP_UP_AMOUNT = "0.2";
  mutableEnv.FAUCET_VAULT_ALERT_MIN_BALANCE = "20";
}

function applyValidProductionUrls() {
  mutableEnv.NEXT_PUBLIC_BESU_RPC_URL = "https://rpc.example.com";
  mutableEnv.NEXT_PUBLIC_BLOCKSCOUT_URL = "https://scan.example.com";
  mutableEnv.NEXT_PUBLIC_IPFS_GATEWAY_URL = "https://ipfs.example.com/ipfs";
  mutableEnv.IPFS_API_URL = "https://ipfs-api.example.com";
  mutableEnv.IPFS_GATEWAY_URL = "https://ipfs.example.com/ipfs";
}

afterEach(() => {
  restoreEnvValue("NODE_ENV", originalEnv.NODE_ENV);
  restoreEnvValue("NEXT_PUBLIC_BESU_RPC_URL", originalEnv.NEXT_PUBLIC_BESU_RPC_URL);
  restoreEnvValue("NEXT_PUBLIC_BESU_CHAIN_ID", originalEnv.NEXT_PUBLIC_BESU_CHAIN_ID);
  restoreEnvValue("NEXT_PUBLIC_BLOCKSCOUT_URL", originalEnv.NEXT_PUBLIC_BLOCKSCOUT_URL);
  restoreEnvValue(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
    originalEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  );
  restoreEnvValue("NEXT_PUBLIC_IPFS_GATEWAY_URL", originalEnv.NEXT_PUBLIC_IPFS_GATEWAY_URL);
  restoreEnvValue("UPLOAD_AUTH_SECRET", originalEnv.UPLOAD_AUTH_SECRET);
  restoreEnvValue("IPFS_API_URL", originalEnv.IPFS_API_URL);
  restoreEnvValue("IPFS_GATEWAY_URL", originalEnv.IPFS_GATEWAY_URL);
  restoreEnvValue("DATABASE_URL", originalEnv.DATABASE_URL);
  restoreEnvValue("API_RATE_LIMIT_MAX", originalEnv.API_RATE_LIMIT_MAX);
  restoreEnvValue("REDIS_URL", originalEnv.REDIS_URL);
  restoreEnvValue("BESU_ADMIN_RPC_URL", originalEnv.BESU_ADMIN_RPC_URL);
  restoreEnvValue("BESU_ADMIN_RPC_TOKEN", originalEnv.BESU_ADMIN_RPC_TOKEN);
  restoreEnvValue("ADMIN_ADDRESSES", originalEnv.ADMIN_ADDRESSES);
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
  restoreEnvValue(
    "FAUCET_AUTH_SIGNER_PRIVATE_KEY",
    originalEnv.FAUCET_AUTH_SIGNER_PRIVATE_KEY
  );
  restoreEnvValue(
    "FAUCET_RELAYER_PRIVATE_KEY",
    originalEnv.FAUCET_RELAYER_PRIVATE_KEY
  );
  restoreEnvValue(
    "FAUCET_TOP_UP_FUNDER_PRIVATE_KEY",
    originalEnv.FAUCET_TOP_UP_FUNDER_PRIVATE_KEY
  );
  restoreEnvValue("SYSTEM_API_TOKEN", originalEnv.SYSTEM_API_TOKEN);
  restoreEnvValue("REBALANCE_API_TOKEN", originalEnv.REBALANCE_API_TOKEN);
  restoreEnvValue(
    "FAUCET_RELAYER_ALERT_MIN_BALANCE",
    originalEnv.FAUCET_RELAYER_ALERT_MIN_BALANCE
  );
  restoreEnvValue(
    "FAUCET_RELAYER_TOP_UP_AMOUNT",
    originalEnv.FAUCET_RELAYER_TOP_UP_AMOUNT
  );
  restoreEnvValue(
    "FAUCET_VAULT_ALERT_MIN_BALANCE",
    originalEnv.FAUCET_VAULT_ALERT_MIN_BALANCE
  );
});

describe("env", () => {
  it("applies defaults for public variables", () => {
    delete process.env.NEXT_PUBLIC_BESU_RPC_URL;
    delete process.env.NEXT_PUBLIC_BESU_CHAIN_ID;
    delete process.env.NEXT_PUBLIC_BLOCKSCOUT_URL;
    delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL;

    expect(getPublicEnv()).toMatchObject({
      NEXT_PUBLIC_BESU_RPC_URL: "http://127.0.0.1:8545",
      NEXT_PUBLIC_BESU_CHAIN_ID: 20260,
      NEXT_PUBLIC_BLOCKSCOUT_URL: "http://127.0.0.1:8182",
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "",
      NEXT_PUBLIC_IPFS_GATEWAY_URL: "http://127.0.0.1:8080/ipfs",
    });
  });

  it("treats blank optional server values as undefined", () => {
    applyValidServerEnv();
    mutableEnv.REDIS_URL = "";
    mutableEnv.BESU_ADMIN_RPC_URL = "";
    mutableEnv.BESU_ADMIN_RPC_TOKEN = "";
    mutableEnv.ADMIN_ADDRESSES = "";
    mutableEnv.DATABASE_URL = "";

    expect(getServerEnv().DATABASE_URL).toBeUndefined();
    expect(getServerEnv().REDIS_URL).toBeUndefined();
    expect(getServerEnv().BESU_ADMIN_RPC_URL).toBeUndefined();
    expect(getServerEnv().BESU_ADMIN_RPC_TOKEN).toBeUndefined();
    expect(getServerEnv().ADMIN_ADDRESSES).toBeUndefined();
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

  it("allows runtime public config without the production localhost guard", () => {
    applyValidServerEnv();
    mutableEnv.NODE_ENV = "production";

    expect(getPublicRuntimeEnv()).toMatchObject({
      NEXT_PUBLIC_BESU_RPC_URL: "http://127.0.0.1:8545",
      NEXT_PUBLIC_BLOCKSCOUT_URL: "http://127.0.0.1:8182",
    });
  });

  it(
    "does not throw when importing branding, chains, and wagmi modules in production",
    async () => {
      applyValidServerEnv();
      mutableEnv.NODE_ENV = "production";
      vi.resetModules();

      await expect(import("./branding")).resolves.toBeTruthy();
      await expect(import("./chains")).resolves.toBeTruthy();
      await expect(import("./wagmi")).resolves.toBeTruthy();
    },
    45000
  );

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

  it("validates faucet auth signer private key format when configured", () => {
    applyValidServerEnv();
    mutableEnv.FAUCET_AUTH_SIGNER_PRIVATE_KEY = "not-a-private-key";

    expect(() => getServerEnv()).toThrow(/FAUCET_AUTH_SIGNER_PRIVATE_KEY/i);
  });

  it("treats blank rebalance api token as undefined", () => {
    applyValidServerEnv();
    mutableEnv.REBALANCE_API_TOKEN = "";

    expect(getServerEnv().REBALANCE_API_TOKEN).toBeUndefined();
  });

  it("treats blank faucet vault alert threshold as undefined", () => {
    applyValidServerEnv();
    mutableEnv.FAUCET_VAULT_ALERT_MIN_BALANCE = "";

    expect(getServerEnv().FAUCET_VAULT_ALERT_MIN_BALANCE).toBeUndefined();
  });
});
