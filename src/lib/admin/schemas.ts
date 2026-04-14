import { getAddress } from "viem";
import { z } from "zod";

const trimmedString = z.string().trim();

const enodeInputSchema = trimmedString
  .min(16, "请填写 Enode")
  .max(512, "Enode 长度过长")
  .regex(/^enode:\/\/[a-zA-Z0-9]+@.+$/, "Enode 格式不正确");

const nodeRpcUrlSchema = trimmedString
  .url("节点 RPC 地址必须是合法的 URL")
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "节点 RPC 地址必须使用 http 或 https"
  );

const validatorAddressSchema = trimmedString
  .regex(/^0x[a-fA-F0-9]{40}$/, "Validator 地址格式不正确")
  .transform((value) => getAddress(value) as `0x${string}`);

const walletAddressSchema = trimmedString
  .regex(/^0x[a-fA-F0-9]{40}$/, "管理员钱包地址格式不正确")
  .transform((value) => getAddress(value) as `0x${string}`);

export const createNodeRequestSchema = z.object({
  nodeName: trimmedString
    .min(2, "节点名称至少需要 2 个字符")
    .max(80, "节点名称长度过长"),
  serverHost: trimmedString
    .min(3, "请填写服务器地址")
    .max(255, "服务器地址长度过长"),
  nodeRpcUrl: z
    .union([nodeRpcUrlSchema, z.literal("")])
    .optional()
    .transform((value) => value || ""),
  enode: enodeInputSchema,
  description: trimmedString.max(1000, "说明内容过长").optional().default(""),
});

export const reviewNodeRequestSchema = z.object({
  reviewComment: trimmedString
    .max(500, "审批备注过长")
    .optional()
    .transform((value) => value || ""),
});

export const createValidatorRequestSchema = z.object({
  nodeRequestId: trimmedString.uuid("请选择已批准的普通节点"),
  validatorAddress: validatorAddressSchema,
  description: trimmedString.max(1000, "说明内容过长").optional().default(""),
});

export const reviewValidatorRequestSchema = reviewNodeRequestSchema;

export const createAdminAddressSchema = z.object({
  walletAddress: walletAddressSchema,
  remark: trimmedString
    .max(200, "管理员备注过长")
    .optional()
    .transform((value) => value || ""),
});

export const updateAdminAddressSchema = z
  .object({
    isActive: z.boolean().optional(),
    remark: trimmedString
      .max(200, "管理员备注过长")
      .optional()
      .transform((value) => (value === undefined ? undefined : value || "")),
  })
  .refine((value) => value.isActive !== undefined || value.remark !== undefined, {
    message: "至少需要提供一个更新字段",
  });
