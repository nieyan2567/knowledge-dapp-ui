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

export async function inspectUploadFile(file: Pick<File, "arrayBuffer" | "type">) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const declaredMime = normalizeMime(file.type);
  const binaryType = await fileTypeFromBuffer(buffer);

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
