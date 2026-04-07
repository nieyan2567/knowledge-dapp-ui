import { syncRewardIndexOnce } from "./handlers/reward";
import { ensureIndexerEnvLoaded, stringifyWithBigInt } from "./runtime";

ensureIndexerEnvLoaded();

async function main() {
  const result = await syncRewardIndexOnce();
  console.info(stringifyWithBigInt(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
