import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGETS = [
  "src",
  "e2e",
  ".github",
  "README.md",
  ".env.example",
  ".env.production.example",
];

const EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".env",
  ".example",
]);

const MOJIBAKE_PATTERNS = [
  /�/u,
  /鍗|鏈€|璇|鏃|鍐|閽|缃|寮|鍚|浣|鐢|鏇|璐|婵€|閲|闂|鍒|銆俙/u,
];

function shouldCheck(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  if (
    normalized.includes("/node_modules/") ||
    normalized.includes("/.next/") ||
    normalized.includes("/test-results/")
  ) {
    return false;
  }

  const extension = path.extname(filePath);
  return EXTENSIONS.has(extension) || filePath.endsWith(".env.example");
}

function collectFiles(targetPath, collected) {
  const fullPath = path.resolve(ROOT, targetPath);
  const stats = statSync(fullPath);

  if (stats.isDirectory()) {
    for (const entry of readdirSync(fullPath)) {
      collectFiles(path.join(fullPath, entry), collected);
    }
    return;
  }

  if (stats.isFile() && shouldCheck(fullPath)) {
    collected.push(fullPath);
  }
}

const files = [];
for (const target of TARGETS) {
  collectFiles(target, files);
}

const hits = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (MOJIBAKE_PATTERNS.some((pattern) => pattern.test(line))) {
      hits.push({
        file: path.relative(ROOT, file).replaceAll("\\", "/"),
        line: index + 1,
        text: line.trim(),
      });
    }
  }
}

if (hits.length > 0) {
  console.error("Detected possible text encoding issues:");
  for (const hit of hits) {
    console.error(`${hit.file}:${hit.line}: ${hit.text}`);
  }
  process.exit(1);
}

console.log("No text encoding issues detected in tracked source/docs.");
