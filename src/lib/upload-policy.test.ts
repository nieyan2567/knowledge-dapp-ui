import { describe, expect, it } from "vitest";

import {
  DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
  formatUploadFileSize,
  validateUploadFile,
  validateUploadFileServer,
} from "./upload-policy";

describe("upload-policy", () => {
  it("accepts common low-risk files in base validation", () => {
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

  it("rejects mime mismatch between declared text and actual binary content", async () => {
    const file = new File(["%PDF-1.7\n1 0 obj\n"], "report.txt", {
      type: "text/plain",
    });

    const result = await validateUploadFileServer(file);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("文件声明为文本类型，但实际内容疑似二进制文件");
      expect(result.status).toBe(400);
    }
  });

  it("rejects text files containing dangerous script content", async () => {
    const file = new File(["<script>alert(1)</script>"], "note.txt", {
      type: "text/plain",
    });

    const result = await validateUploadFileServer(file);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("服务端检测到高风险真实文件类型，禁止上传");
      expect(result.status).toBe(400);
    }
  });

  it("accepts a valid pdf file in server validation", async () => {
    const file = new File(["%PDF-1.7\n1 0 obj\n"], "paper.pdf", {
      type: "application/pdf",
    });

    const result = await validateUploadFileServer(file);

    expect(result).toEqual({ ok: true });
  });

  it("formats upload file sizes for display", () => {
    expect(formatUploadFileSize(512)).toBe("512 B");
    expect(formatUploadFileSize(2048)).toBe("2 KB");
    expect(formatUploadFileSize(512 * 1024 * 1024)).toBe("512 MB");
  });
});
