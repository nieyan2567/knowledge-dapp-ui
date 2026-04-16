/**
 * @notice 上传文件策略校验工具。
 * @dev 定义上传大小、文件名、高风险扩展名和 MIME 类型规则，并提供客户端与服务端校验函数。
 */
import { getServerEnv } from "./env";
import { scanTextContent } from "./upload-content-scan";
import { areMimeTypesCompatible, inspectUploadFile } from "./upload-sniff";

/**
 * @notice 默认上传文件大小上限。
 * @dev 当前默认值为 512 MB。
 */
export const DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES = 512 * 1024 * 1024;
/**
 * @notice 上传文件名最大长度限制。
 * @dev 超过该长度的文件名会被直接拒绝。
 */
export const MAX_UPLOAD_FILENAME_LENGTH = 180;

/**
 * @notice 高风险上传文件扩展名集合。
 * @dev 这些扩展名通常可执行或可承载脚本，默认禁止上传。
 */
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

/**
 * @notice 高风险上传 MIME 类型集合。
 * @dev 用于拦截可执行脚本、HTML 壳和潜在危险文件类型。
 */
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

/**
 * @notice 上传校验结果结构。
 * @dev 成功时仅返回 `ok: true`；失败时带回错误文案与 HTTP 状态码。
 */
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

/**
 * @notice 获取当前环境下允许的最大上传文件大小。
 * @returns 允许上传的最大字节数。
 */
export function getUploadMaxFileSizeBytes() {
  if (typeof window !== "undefined") {
    return DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES;
  }

  const value =
    getServerEnv().UPLOAD_MAX_FILE_SIZE_BYTES ||
    DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES;

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES;
  }

  return Math.floor(value);
}

/**
 * @notice 将字节数格式化为便于展示的大小文本。
 * @param bytes 文件大小，单位为字节。
 * @returns MB、KB 或 B 级别的格式化字符串。
 */
export function formatUploadFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${bytes} B`;
}

/**
 * @notice 执行上传文件的基础策略校验。
 * @param file 仅包含名称、大小和声明 MIME 的文件对象。
 * @param maxFileSizeBytes 当前允许的最大文件大小。
 * @returns 校验结果对象。
 */
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

/**
 * @notice 在服务端执行更严格的上传文件校验。
 * @param file 包含二进制内容的上传文件对象。
 * @returns 校验结果对象。
 */
export async function validateUploadFileServer(
  file: Pick<File, "name" | "size" | "type" | "arrayBuffer">
): Promise<UploadValidationResult> {
  const baseValidation = validateUploadFile(file);
  if (!baseValidation.ok) {
    return baseValidation;
  }

  /**
   * @notice 服务端会继续检查真实 MIME、文本特征与敏感模式。
   * @dev 该层用于补足浏览器侧仅凭扩展名和声明 MIME 无法发现的风险。
   */
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
