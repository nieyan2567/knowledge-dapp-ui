import { syncProposalIndexOnce } from "./handlers/proposal";
import { ensureIndexerEnvLoaded, stringifyWithBigInt } from "./runtime";

ensureIndexerEnvLoaded();

async function main() {
  const result = await syncProposalIndexOnce();
  console.info(stringifyWithBigInt(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
