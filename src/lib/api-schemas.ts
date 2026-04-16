/**
 * @notice API 输入与响应的 Zod Schema 定义。
 * @dev 集中管理地址、nonce、签名、上传文件以及 Kubo 返回结果的基础校验规则。
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
 * @notice 钱包签名输入校验规则。
 * @dev 要求为非空的十六进制签名字串。
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
