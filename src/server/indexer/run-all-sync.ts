import { ensureIndexerEnvLoaded, runAllIndexerSyncsOnce, stringifyWithBigInt } from "./runtime";

ensureIndexerEnvLoaded();

async function main() {
  const result = await runAllIndexerSyncsOnce();
  console.info(stringifyWithBigInt(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
