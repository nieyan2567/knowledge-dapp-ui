import { ensureIndexerEnvLoaded, stringifyWithBigInt } from "./runtime";
import { syncSystemIndexOnce } from "./handlers/system";

ensureIndexerEnvLoaded();

async function main() {
  const result = await syncSystemIndexOnce();
  console.info(stringifyWithBigInt(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
