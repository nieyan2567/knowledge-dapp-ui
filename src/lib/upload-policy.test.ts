import { describe, expect, it } from "vitest";

import {
  DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
  formatUploadFileSize,
  validateUploadFile,
} from "./upload-policy";

describe("upload-policy", () => {
  it("accepts common low-risk files", () => {
    const result = validateUploadFile({
      name: "paper.pdf",
      size: 1024,
      type: "application/pdf",
    });

    expect(result).toEqual({ ok: true });
  });

  it("rejects blocked high-risk extensions", () => {
    const result = validateUploadFile({
      name: "payload.exe",
      size: 1024,
      type: "application/octet-stream",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("该文件格式存在安全风险，禁止上传");
      expect(result.status).toBe(400);
    }
  });

  it("rejects blocked high-risk mime types", () => {
    const result = validateUploadFile({
      name: "vector.txt",
      size: 1024,
      type: "image/svg+xml",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("该文件类型存在安全风险，禁止上传");
      expect(result.status).toBe(400);
    }
  });

  it("rejects files above the size limit", () => {
    const result = validateUploadFile(
      {
        name: "large.pdf",
        size: DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES + 1,
        type: "application/pdf",
      },
      DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("文件过大，当前上限为 512 MB");
      expect(result.status).toBe(413);
    }
  });

  it("formats upload file sizes for display", () => {
    expect(formatUploadFileSize(512)).toBe("512 B");
    expect(formatUploadFileSize(2048)).toBe("2 KB");
    expect(formatUploadFileSize(512 * 1024 * 1024)).toBe("512 MB");
  });
});
