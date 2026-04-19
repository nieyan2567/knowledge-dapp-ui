/**
 * @file API 输入与响应的 Zod Schema 定义。
 * @description 集中管理地址、nonce、签名、上传文件、上传记录回写以及 Kubo 返回结果的校验规则。
 */
import { z } from "zod";

const trimmedString = z.string().trim();

/**
 * @notice 钱包地址输入校验规则。
 * @dev 要求非空、长度合理且满足 0x 开头的 40 字节十六进制地址格式。
 */
export const addressInputSchema = trimmedString
  .min(1, "缺少钱包地址")
  .max(128, "钱包地址格式无效")
  .regex(/^0x[a-fA-F0-9]{40}$/, "钱包地址格式无效");

/**
 * @notice nonce 输入校验规则。
 * @dev 主要约束 nonce 不为空且长度不超过服务端允许范围。
 */
export const nonceInputSchema = trimmedString
  .min(1, "缺少 nonce")
  .max(256, "nonce 格式无效");

/**
 * @notice IPFS CID 输入校验规则。
 * @dev 当前只要求 CID 非空且长度合理，不在前端强制指定具体编码类型。
 */
export const cidInputSchema = trimmedString
  .min(1, "缺少 CID")
  .max(256, "CID 格式无效");

/**
 * @notice 上传记录 ID 校验规则。
 * @dev 上传回写与孤儿清理都会使用这类整数主键定位具体记录。
 */
export const uploadRecordIdInputSchema = z.coerce
  .number()
  .int("上传记录 ID 格式无效")
  .positive("缺少上传记录 ID");

/**
 * @notice 链上交易哈希输入校验规则。
 * @dev 要求为 0x 开头的十六进制字符串。
 */
export const txHashInputSchema = trimmedString
  .min(1, "缺少交易哈希")
  .max(256, "交易哈希格式无效")
  .regex(/^0x[0-9a-fA-F]+$/, "交易哈希格式无效");

/**
 * @notice 钱包签名输入校验规则。
 * @dev 要求为非空的十六进制签名字符串。
 */
export const signatureInputSchema = trimmedString
  .min(1, "缺少签名")
  .max(256, "签名格式无效")
  .regex(/^0x[0-9a-fA-F]+$/, "签名格式无效");

/**
 * @notice 带签名请求体的统一校验规则。
 * @dev 适用于需要地址、nonce 和签名三元组的 API 请求。
 */
export const signedRequestBodySchema = z.object({
  address: addressInputSchema,
  nonce: nonceInputSchema,
  signature: signatureInputSchema,
});

/**
 * @notice 上传记录登记完成回写请求体。
 * @dev 前端在链上登记确认后，会使用上传记录 ID 与交易哈希回写结果。
 */
export const uploadRegisterCompleteBodySchema = z.object({
  uploadId: uploadRecordIdInputSchema,
  txHash: txHashInputSchema,
});

/**
 * @notice 孤儿上传清理请求体。
 * @dev 前端在发布失败后触发即时回收，或系统接口执行单条清理时使用。
 */
export const uploadCleanupBodySchema = z.object({
  uploadId: uploadRecordIdInputSchema,
  reason: trimmedString.max(120, "清理原因过长").optional(),
});

/**
 * @notice Faucet nonce 请求查询参数规则。
 * @dev 当前仅要求调用方提供合法钱包地址。
 */
export const faucetNonceQuerySchema = z.object({
  address: addressInputSchema,
});

/**
 * @notice 上传文件对象校验规则。
 * @dev 要求存在有效文件实例、非空文件名和非零大小。
 */
export const uploadFileSchema = z
  .instanceof(File, { message: "未检测到上传文件" })
  .refine((file) => file.name.trim().length > 0, "未检测到上传文件")
  .refine((file) => file.size > 0, "未检测到上传文件");

/**
 * @notice Kubo `add` 接口响应校验规则。
 * @dev 当前只要求返回值中包含有效的 `Hash` 字段。
 */
export const kuboAddResponseSchema = z.object({
  Hash: z.string().trim().min(1, "IPFS 未返回有效 CID"),
});
