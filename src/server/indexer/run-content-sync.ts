import { syncContentIndexOnce } from "./handlers/content";
import { ensureIndexerEnvLoaded, stringifyWithBigInt } from "./runtime";

ensureIndexerEnvLoaded();

async function main() {
  const result = await syncContentIndexOnce();
  console.info(stringifyWithBigInt(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
