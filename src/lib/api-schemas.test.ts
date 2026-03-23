import { describe, expect, it } from "vitest";

import {
  addressInputSchema,
  faucetNonceQuerySchema,
  kuboAddResponseSchema,
  signedRequestBodySchema,
  uploadFileSchema,
} from "./api-schemas";

describe("api-schemas", () => {
  it("accepts and trims a valid signed request body", () => {
    const parsed = signedRequestBodySchema.parse({
      address: "  0x1111111111111111111111111111111111111111  ",
      nonce: "  nonce-123  ",
      signature: "  0xabcdef  ",
    });

    expect(parsed).toEqual({
      address: "0x1111111111111111111111111111111111111111",
      nonce: "nonce-123",
      signature: "0xabcdef",
    });
  });

  it("rejects invalid wallet addresses", () => {
    const result = addressInputSchema.safeParse("not-an-address");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("钱包地址格式无效");
    }
  });

  it("accepts an optional address for faucet nonce query", () => {
    const result = faucetNonceQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({});
    }
  });

  it("validates upload files", () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const result = uploadFileSchema.safeParse(file);

    expect(result.success).toBe(true);
  });

  it("rejects empty upload files", () => {
    const file = new File([""], "empty.txt", { type: "text/plain" });
    const result = uploadFileSchema.safeParse(file);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("未检测到上传文件");
    }
  });

  it("validates kubo responses", () => {
    const result = kuboAddResponseSchema.safeParse({ Hash: "QmTestCid" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.Hash).toBe("QmTestCid");
    }
  });
});
