import { scanTextContent } from "./upload-content-scan";
import { areMimeTypesCompatible, inspectUploadFile } from "./upload-sniff";

export const DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES = 512 * 1024 * 1024;
export const MAX_UPLOAD_FILENAME_LENGTH = 180;

export const HIGH_RISK_UPLOAD_EXTENSIONS = new Set([
  ".bat",
  ".cmd",
  ".com",
  ".cjs",
  ".dll",
  ".exe",
  ".htm",
  ".html",
  ".jar",
  ".js",
  ".jsx",
  ".mjs",
  ".msi",
  ".php",
  ".ps1",
  ".scr",
  ".sh",
  ".svg",
  ".svgz",
  ".ts",
  ".tsx",
  ".vbs",
]);

export const HIGH_RISK_UPLOAD_MIME_TYPES = new Set([
  "application/javascript",
  "application/x-bat",
  "application/x-httpd-php",
  "application/x-javascript",
  "application/x-msdos-program",
  "application/x-msdownload",
  "application/x-powershell",
  "application/x-sh",
  "image/svg+xml",
  "text/html",
  "text/javascript",
  "text/php",
  "text/x-shellscript",
]);

type UploadValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
    return "";
  }

  return normalized.slice(dotIndex);
}

export function getUploadMaxFileSizeBytes() {
  const value = Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES || DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES;
  }

  return Math.floor(value);
}

export function formatUploadFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${bytes} B`;
}

export function validateUploadFile(
  file: Pick<File, "name" | "size" | "type">,
  maxFileSizeBytes = getUploadMaxFileSizeBytes()
): UploadValidationResult {
  const fileName = file.name.trim();

  if (!fileName || file.size <= 0) {
    return {
      ok: false,
      error: "未检测到有效上传文件",
      status: 400,
    };
  }

  if (fileName.length > MAX_UPLOAD_FILENAME_LENGTH) {
    return {
      ok: false,
      error: "文件名过长，请缩短后再上传",
      status: 400,
    };
  }

  if (file.size > maxFileSizeBytes) {
    return {
      ok: false,
      error: `文件过大，当前上限为 ${formatUploadFileSize(maxFileSizeBytes)}`,
      status: 413,
    };
  }

  const extension = getFileExtension(fileName);
  if (extension && HIGH_RISK_UPLOAD_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      error: "该文件格式存在安全风险，禁止上传",
      status: 400,
    };
  }

  const mimeType = file.type.trim().toLowerCase();
  if (mimeType && HIGH_RISK_UPLOAD_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      error: "该文件类型存在安全风险，禁止上传",
      status: 400,
    };
  }

  return { ok: true };
}

export async function validateUploadFileServer(
  file: Pick<File, "name" | "size" | "type" | "arrayBuffer">
): Promise<UploadValidationResult> {
  const baseValidation = validateUploadFile(file);
  if (!baseValidation.ok) {
    return baseValidation;
  }

  const inspection = await inspectUploadFile(file);

  if (
    inspection.sniffedMime &&
    HIGH_RISK_UPLOAD_MIME_TYPES.has(inspection.sniffedMime)
  ) {
    return {
      ok: false,
      error: "服务端检测到高风险真实文件类型，禁止上传",
      status: 400,
    };
  }

  if (
    inspection.declaredMime?.startsWith("text/") &&
    !inspection.isTextLike
  ) {
    return {
      ok: false,
      error: "文件声明为文本类型，但实际内容疑似二进制文件",
      status: 400,
    };
  }

  if (
    !areMimeTypesCompatible(
      inspection.declaredMime,
      inspection.sniffedMime,
      inspection.isTextLike
    )
  ) {
    return {
      ok: false,
      error: "文件声明类型与服务端识别结果不一致，已拒绝上传",
      status: 400,
    };
  }

  if (inspection.isTextLike) {
    const scanResult = scanTextContent(inspection.buffer);

    if (!scanResult.ok) {
      return {
        ok: false,
        error: scanResult.message,
        status: 400,
      };
    }
  }

  return { ok: true };
}
