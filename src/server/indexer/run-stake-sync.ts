import { syncStakeIndexOnce } from "./handlers/stake";
import { ensureIndexerEnvLoaded, stringifyWithBigInt } from "./runtime";

ensureIndexerEnvLoaded();

async function main() {
  const result = await syncStakeIndexOnce();
  console.info(stringifyWithBigInt(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
