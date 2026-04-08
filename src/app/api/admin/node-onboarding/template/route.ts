import { readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const templateRoot = path.join(process.cwd(), "infra", "besu-join-node");

const templateFiles = [
  ".env.example",
  "docker-compose.yml",
  "README.md",
  path.join("network", "README.md"),
  path.join("scripts", "get-enode.sh"),
  path.join("scripts", "get-enode.ps1"),
];

export async function GET() {
  const zip = new JSZip();

  await Promise.all(
    templateFiles.map(async (filePath) => {
      const absolutePath = path.join(templateRoot, filePath);
      const content = await readFile(absolutePath);
      zip.file(path.join("besu-join-node", filePath).replaceAll("\\", "/"), content);
    })
  );

  const archive = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: {
      level: 9,
    },
  });

  return new NextResponse(Buffer.from(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="besu-join-node-template.zip"',
      "Cache-Control": "no-store",
    },
  });
}
