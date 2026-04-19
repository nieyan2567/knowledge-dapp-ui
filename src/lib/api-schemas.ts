/**
 * @file API 输入与响应的 Zod Schema 定义。
 * @description 集中管理地址、nonce、签名、上传文件、上传记录回写、内容生命周期回写以及 Kubo 返回结果的校验规则。
 */
import { z } from "zod";

const trimmedString = z.string().trim();

export const addressInputSchema = trimmedString
  .min(1, "缺少钱包地址")
  .max(128, "钱包地址格式无效")
  .regex(/^0x[a-fA-F0-9]{40}$/, "钱包地址格式无效");

export const nonceInputSchema = trimmedString
  .min(1, "缺少 nonce")
  .max(256, "nonce 格式无效");

export const cidInputSchema = trimmedString
  .min(1, "缺少 CID")
  .max(256, "CID 格式无效");

export const uploadRecordIdInputSchema = z.coerce
  .number()
  .int("上传记录 ID 格式无效")
  .positive("缺少上传记录 ID");

export const txHashInputSchema = trimmedString
  .min(1, "缺少交易哈希")
  .max(256, "交易哈希格式无效")
  .regex(/^0x[0-9a-fA-F]+$/, "交易哈希格式无效");

export const signatureInputSchema = trimmedString
  .min(1, "缺少签名")
  .max(256, "签名格式无效")
  .regex(/^0x[0-9a-fA-F]+$/, "签名格式无效");

export const signedRequestBodySchema = z.object({
  address: addressInputSchema,
  nonce: nonceInputSchema,
  signature: signatureInputSchema,
});

export const uploadRegisterCompleteBodySchema = z.object({
  uploadId: uploadRecordIdInputSchema,
  txHash: txHashInputSchema,
  kind: z.enum(["register", "update"]),
});

export const uploadCleanupBodySchema = z.object({
  uploadId: uploadRecordIdInputSchema,
  reason: trimmedString.max(120, "清理原因过长").optional(),
});

export const contentLifecycleBodySchema = z.object({
  contentId: z.coerce
    .number()
    .int("内容 ID 格式无效")
    .positive("缺少内容 ID"),
  txHash: txHashInputSchema,
  action: z.enum(["delete", "restore"]),
});

export const faucetNonceQuerySchema = z.object({
  address: addressInputSchema,
});

export const uploadFileSchema = z
  .instanceof(File, { message: "未检测到上传文件" })
  .refine((file) => file.name.trim().length > 0, "未检测到上传文件")
  .refine((file) => file.size > 0, "未检测到上传文件");

export const kuboAddResponseSchema = z.object({
  Hash: z.string().trim().min(1, "IPFS 未返回有效 CID"),
});
