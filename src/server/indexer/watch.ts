import { getServerEnv } from "@/lib/env";

import { ensureIndexerEnvLoaded, runAllIndexerSyncsOnce, sleep, stringifyWithBigInt } from "./runtime";

ensureIndexerEnvLoaded();

async function main() {
  const env = getServerEnv();

  if (!env.INDEXER_ENABLED) {
    throw new Error("INDEXER_ENABLED must be true to run the indexer watch loop");
  }

  console.info(
    `[indexer] watch loop started (interval=${env.INDEXER_POLL_INTERVAL_MS}ms, confirmations=${env.INDEXER_CONFIRMATIONS})`
  );

  while (true) {
    const startedAt = Date.now();

    try {
      const result = await runAllIndexerSyncsOnce();
      console.info(`[indexer] cycle complete\n${stringifyWithBigInt(result)}`);
    } catch (error) {
      console.error("[indexer] cycle failed", error);
    }

    const elapsedMs = Date.now() - startedAt;
    const waitMs = Math.max(env.INDEXER_POLL_INTERVAL_MS - elapsedMs, 0);

    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
