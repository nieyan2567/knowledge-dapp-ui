import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const templateRoot = path.join(process.cwd(), "infra", "besu-join-node");

async function collectTemplateFiles(root: string, currentDir = ""): Promise<string[]> {
  const absoluteDir = path.join(root, currentDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        return collectTemplateFiles(root, relativePath);
      }

      return relativePath;
    })
  );

  return files.flat().sort();
}

export async function GET() {
  const zip = new JSZip();
  const templateFiles = await collectTemplateFiles(templateRoot);

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
