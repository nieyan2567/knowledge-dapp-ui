/**
 * @notice 上传文件类型嗅探工具。
 * @dev 通过文件头和文本内容推断真实 MIME 类型，并判断声明类型是否可信。
 */
import { fileTypeFromBuffer } from "file-type";

const GENERIC_DECLARED_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
]);

const SAFE_TEXTUAL_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/ld+json",
  "application/xml",
  "text/xml",
]);

/**
 * @notice 上传文件探测结果结构。
 * @dev 包含原始缓冲区、声明 MIME、嗅探 MIME、识别来源和文本性质判断。
 */
export type UploadInspection = {
  buffer: Buffer;
  declaredMime: string | null;
  sniffedMime: string | null;
  sniffedExtension: string | null;
  detectionSource: "binary-signature" | "text-content" | "unknown";
  isTextLike: boolean;
};

function normalizeMime(mime: string | null | undefined) {
  const normalized = mime?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function hasUtfBom(buffer: Buffer) {
  if (buffer.length < 2) {
    return false;
  }

  return (
    (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) ||
    (buffer[0] === 0xff && buffer[1] === 0xfe) ||
    (buffer[0] === 0xfe && buffer[1] === 0xff)
  );
}

function isLikelyTextBuffer(buffer: Buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));

  if (sample.length === 0 || hasUtfBom(sample)) {
    return true;
  }

  let suspiciousControlCount = 0;

  for (const byte of sample) {
    if (byte === 0) {
      return false;
    }

    const isAllowedWhitespace = byte === 9 || byte === 10 || byte === 13;
    const isPrintableAscii = byte >= 32 && byte <= 126;
    const isHighByte = byte >= 128;

    if (!isAllowedWhitespace && !isPrintableAscii && !isHighByte) {
      suspiciousControlCount += 1;
    }
  }

  return suspiciousControlCount / sample.length < 0.03;
}

function inferTextMime(text: string) {
  const trimmed = text.trimStart();

  if (!trimmed) {
    return "text/plain";
  }

  if (/^<!doctype\s+html|^<(html|head|body|script|iframe)\b/i.test(trimmed)) {
    return "text/html";
  }

  if (/^<svg\b/i.test(trimmed)) {
    return "image/svg+xml";
  }

  if (/^<\?(xml)\b/i.test(trimmed)) {
    return "application/xml";
  }

  if (/^<\?(php|=)/i.test(trimmed)) {
    return "text/php";
  }

  if (/^#!.*\b(bash|sh|zsh|fish)\b/im.test(trimmed)) {
    return "text/x-shellscript";
  }

  if (/^#!.*\b(powershell|pwsh)\b/im.test(trimmed)) {
    return "application/x-powershell";
  }

  if (/@echo\s+off|\bcmd\.exe\b|\bsetlocal\b/i.test(trimmed)) {
    return "application/x-bat";
  }

  try {
    JSON.parse(trimmed);
    return "application/json";
  } catch {
    return "text/plain";
  }
}

/**
 * @notice 判断声明 MIME 与服务端嗅探 MIME 是否兼容。
 * @param declaredMime 客户端声明的 MIME 类型。
 * @param sniffedMime 服务端嗅探得到的 MIME 类型。
 * @param isTextLike 当前文件是否表现为文本内容。
 * @returns 若两者可以接受地匹配则返回 `true`。
 */
export function areMimeTypesCompatible(
  declaredMime: string | null,
  sniffedMime: string | null,
  isTextLike: boolean
) {
  if (!sniffedMime) {
    return true;
  }

  if (!declaredMime || GENERIC_DECLARED_MIME_TYPES.has(declaredMime)) {
    return true;
  }

  if (declaredMime === sniffedMime) {
    return true;
  }

  if (isTextLike && SAFE_TEXTUAL_MIME_TYPES.has(declaredMime) && SAFE_TEXTUAL_MIME_TYPES.has(sniffedMime)) {
    return true;
  }

  return false;
}

/**
 * @notice 检测上传文件的真实类型与内容属性。
 * @param file 需要检测的文件对象，只要求提供二进制内容与声明 MIME。
 * @returns 包含检测结果的 `UploadInspection` 对象。
 */
export async function inspectUploadFile(file: Pick<File, "arrayBuffer" | "type">) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const declaredMime = normalizeMime(file.type);
  const binaryType = await fileTypeFromBuffer(buffer);

  /**
   * @notice 优先使用文件头特征识别二进制格式。
   * @dev 若识别成功，则直接按二进制类型返回，避免误判为文本。
   */
  if (binaryType) {
    return {
      buffer,
      declaredMime,
      sniffedMime: normalizeMime(binaryType.mime),
      sniffedExtension: binaryType.ext,
      detectionSource: "binary-signature" as const,
      isTextLike: false,
    } satisfies UploadInspection;
  }

  /**
   * @notice 无法识别为二进制时，再尝试按文本内容推断类型。
   * @dev 这样可以处理 markdown、json、xml 等没有强文件头的文本格式。
   */
  if (isLikelyTextBuffer(buffer)) {
    const textSample = new TextDecoder("utf-8", { fatal: false }).decode(
      buffer.subarray(0, Math.min(buffer.length, 128 * 1024))
    );

    return {
      buffer,
      declaredMime,
      sniffedMime: inferTextMime(textSample),
      sniffedExtension: null,
      detectionSource: "text-content" as const,
      isTextLike: true,
    } satisfies UploadInspection;
  }

  return {
    buffer,
    declaredMime,
    sniffedMime: null,
    sniffedExtension: null,
    detectionSource: "unknown" as const,
    isTextLike: false,
  } satisfies UploadInspection;
}
