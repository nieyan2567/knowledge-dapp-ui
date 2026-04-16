/**
 * @notice `api-validation` 模块测试。
 * @dev 覆盖 JSON 请求体验证、独立值校验和错误响应行为。
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseJsonBody, parseValue } from "./api-validation";

describe("api-validation", () => {
  it("parses a valid json body with schema", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "alice" }),
    });

    const result = await parseJsonBody(
      req,
      z.object({
        name: z.string().min(1),
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: "alice" });
    }
  });

  it("returns a 400 response when json is invalid", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{",
    });

    const result = await parseJsonBody(req, z.object({}));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({
        error: "请求体格式无效",
      });
    }
  });

  it("returns schema error messages for invalid json body", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "" }),
    });

    const result = await parseJsonBody(
      req,
      z.object({
        name: z.string().min(1, "名称不能为空"),
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({
        error: "名称不能为空",
      });
    }
  });

  it("parses standalone values with schema", async () => {
    const result = parseValue(" 0x123 ", z.string().trim().min(1), "无效值");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("0x123");
    }
  });

  it("returns fallback response for invalid standalone values", async () => {
    const result = parseValue(null, z.string(), "无效值");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({
        error: "Invalid input: expected string, received null",
      });
    }
  });
});
