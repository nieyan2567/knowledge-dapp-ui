import { loadEnvConfig } from "@next/env";

import { syncContentIndexOnce } from "./handlers/content";
import { syncProposalIndexOnce } from "./handlers/proposal";
import { syncRewardIndexOnce } from "./handlers/reward";
import { syncStakeIndexOnce } from "./handlers/stake";
import { syncSystemIndexOnce } from "./handlers/system";

let envLoaded = false;

export function ensureIndexerEnvLoaded() {
  if (envLoaded) {
    return;
  }

  loadEnvConfig(process.cwd());
  envLoaded = true;
}

export function stringifyWithBigInt(value: unknown) {
  return JSON.stringify(
    value,
    (_key, currentValue) =>
      typeof currentValue === "bigint" ? currentValue.toString() : currentValue,
    2
  );
}

export async function runAllIndexerSyncsOnce() {
  const [content, proposal, reward, stake, system] = await Promise.all([
    syncContentIndexOnce(),
    syncProposalIndexOnce(),
    syncRewardIndexOnce(),
    syncStakeIndexOnce(),
    syncSystemIndexOnce(),
  ]);

  return {
    content,
    proposal,
    reward,
    stake,
    system,
  };
}

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
