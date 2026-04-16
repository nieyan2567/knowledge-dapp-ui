/**
 * @notice `upload-sniff` 模块测试。
 * @dev 覆盖二进制签名识别、文本内容推断以及 MIME 兼容性判断。
 */
import { describe, expect, it } from "vitest";

import { areMimeTypesCompatible, inspectUploadFile } from "./upload-sniff";

describe("upload-sniff", () => {
  it("detects pdf files from binary signature", async () => {
    const file = new File(["%PDF-1.7\n1 0 obj\n"], "paper.txt", {
      type: "text/plain",
    });

    const result = await inspectUploadFile(file);

    expect(result.sniffedMime).toBe("application/pdf");
    expect(result.detectionSource).toBe("binary-signature");
    expect(result.isTextLike).toBe(false);
  });

  it("detects html from text content", async () => {
    const file = new File(["<!doctype html><html><body>x</body></html>"], "note.txt", {
      type: "text/plain",
    });

    const result = await inspectUploadFile(file);

    expect(result.sniffedMime).toBe("text/html");
    expect(result.detectionSource).toBe("text-content");
    expect(result.isTextLike).toBe(true);
  });

  it("treats safe textual mime mismatches as compatible", () => {
    expect(
      areMimeTypesCompatible("text/plain", "application/json", true)
    ).toBe(true);
  });

  it("treats dangerous mismatches as incompatible", () => {
    expect(
      areMimeTypesCompatible("text/plain", "application/pdf", false)
    ).toBe(false);
  });
});
