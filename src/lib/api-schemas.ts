import { z } from "zod";

const trimmedString = z.string().trim();

export const addressInputSchema = trimmedString
  .min(1, "缺少钱包地址")
  .max(128, "钱包地址格式无效")
  .regex(/^0x[a-fA-F0-9]{40}$/, "钱包地址格式无效");

export const nonceInputSchema = trimmedString
  .min(1, "缺少 nonce")
  .max(256, "nonce 格式无效");

export const signatureInputSchema = trimmedString
  .min(1, "缺少签名")
  .max(256, "签名格式无效")
  .regex(/^0x[0-9a-fA-F]+$/, "签名格式无效");

export const signedRequestBodySchema = z.object({
  address: addressInputSchema,
  nonce: nonceInputSchema,
  signature: signatureInputSchema,
});

export const faucetNonceQuerySchema = z.object({
  address: addressInputSchema.optional(),
});

export const uploadFileSchema = z
  .instanceof(File, { message: "未检测到上传文件" })
  .refine((file) => file.name.trim().length > 0, "未检测到上传文件")
  .refine((file) => file.size > 0, "未检测到上传文件");

export const kuboAddResponseSchema = z.object({
  Hash: z.string().trim().min(1, "IPFS 未返回有效 CID"),
});
