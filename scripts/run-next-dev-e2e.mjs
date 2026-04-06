import { spawn } from "node:child_process";
import process from "node:process";

const port = process.argv[2] ?? process.env.PLAYWRIGHT_PORT ?? "3100";
const isWindows = process.platform === "win32";
const nextBin = isWindows
  ? "node_modules/next/dist/bin/next"
  : "node_modules/next/dist/bin/next";

const child = spawn(
  process.execPath,
  [nextBin, "dev", "--port", port],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-e2e",
    },
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
