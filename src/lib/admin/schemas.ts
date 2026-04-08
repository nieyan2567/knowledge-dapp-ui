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
  description: trimmedString
    .max(1000, "说明内容过长")
    .optional()
    .default(""),
});

export const reviewNodeRequestSchema = z.object({
  reviewComment: trimmedString
    .max(500, "审批备注过长")
    .optional()
    .transform((value) => value || ""),
});
