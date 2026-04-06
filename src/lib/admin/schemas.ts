import { z } from "zod";

const trimmedString = z.string().trim();

export const enodeInputSchema = trimmedString
  .min(1, "缺少节点 enode")
  .regex(
    /^enode:\/\/[0-9a-fA-F]+@[^:\s]+:\d+$/,
    "节点 enode 格式无效"
  );

export const serverIpInputSchema = trimmedString
  .min(1, "缺少服务器地址")
  .max(255, "服务器地址格式无效");

export const nodeNameInputSchema = trimmedString
  .min(1, "缺少节点名称")
  .max(120, "节点名称过长");

export const validatorAddressInputSchema = trimmedString.regex(
  /^0x[a-fA-F0-9]{40}$/,
  "验证者地址格式无效"
);

export const nodeJoinRequestSchema = z.object({
  nodeName: nodeNameInputSchema,
  serverIp: serverIpInputSchema,
  enode: enodeInputSchema,
});

export const validatorJoinRequestSchema = z.object({
  nodeName: nodeNameInputSchema,
  serverIp: serverIpInputSchema,
  enode: enodeInputSchema,
  validatorAddress: validatorAddressInputSchema,
});

export const reviewRequestSchema = z.object({
  reviewComment: trimmedString.max(500, "审批备注过长").optional(),
});
