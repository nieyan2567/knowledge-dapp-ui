import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * 模块说明：节点接入模板下载接口，负责把 Besu 新节点接入模板打包为 ZIP 并提供下载。
 */
import JSZip from "jszip";
import { NextResponse } from "next/server";

/**
 * 声明当前接口运行在 Node.js 运行时。
 * @returns Next.js 路由运行时标记。
 */
export const runtime = "nodejs";

const templateRoot = path.join(process.cwd(), "infra", "besu-join-node");

/**
 * 递归收集接入模板目录下的所有文件路径。
 * @param root 模板目录的绝对根路径。
 * @param currentDir 当前正在遍历的相对目录。
 * @returns 模板根目录下所有文件的相对路径数组。
 */
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

/**
 * 打包并返回 Besu 节点接入模板压缩包。
 * @returns 包含模板文件的 ZIP 下载响应。
 */
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
