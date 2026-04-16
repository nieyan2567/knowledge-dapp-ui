/**
 * @file 治理模板工具模块。
 * @description 封装治理草稿校验、字段读取、参数编码和展示格式化等公共能力。
 */
import { encodeFunctionData, formatEther, parseEther } from "viem";

import { ABIS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import type { Address, HexString } from "@/types/contracts";
import type {
  GovernanceEncodedAction,
  GovernanceRiskLevel,
} from "@/types/governance";

/**
 * @notice 表示治理模板字段校验结果。
 * @dev 成功时仅返回 `ok: true`，失败时携带错误文案。
 */
export type ValidationResult = { ok: true } | { ok: false; error: string };
/**
 * @notice 提取失败态校验结果类型，方便后续类型缩小。
 */
export type FailedValidation = Extract<ValidationResult, { ok: false }>;

/**
 * @notice 为新的治理草稿生成唯一标识。
 * @returns 草稿唯一标识字符串。
 */
export function createGovernanceDraftId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * @notice 构造成功态校验结果。
 * @returns 成功态结果对象。
 */
export function okValidation(): ValidationResult {
  return { ok: true };
}

/**
 * @notice 构造失败态校验结果。
 * @param error 面向界面的错误文案。
 * @returns 失败态结果对象。
 */
export function failValidation(error: string): FailedValidation {
  return { ok: false, error };
}

/**
 * @notice 判断任意值是否为失败态校验结果。
 * @param value 待判断的值。
 * @returns 若值为失败态校验结果则返回 `true`。
 */
export function isFailedValidation(
  value: unknown
): value is Extract<ValidationResult, { ok: false }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === false
  );
}

/**
 * @notice 从治理草稿值字典中读取并裁剪字符串字段。
 * @param values 草稿字段值映射。
 * @param key 要读取的字段键名。
 * @returns 处理后的字符串；不存在或类型不符时返回空字符串。
 */
export function readGovernanceString(
  values: Record<string, string | boolean>,
  key: string
) {
  const value = values[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @notice 从治理草稿值字典中读取布尔字段。
 * @param values 草稿字段值映射。
 * @param key 要读取的字段键名。
 * @returns 归一化后的布尔值。
 */
export function readGovernanceBoolean(
  values: Record<string, string | boolean>,
  key: string
) {
  const value = values[key];

  if (typeof value === "boolean") {
    return value;
  }

  return value === "true";
}

/**
 * @notice 解析必填的无符号整数输入。
 * @param values 草稿字段值映射。
 * @param key 字段键名。
 * @param label 字段展示名称。
 * @returns 解析成功时返回 `bigint`，失败时返回校验错误。
 */
export function parseRequiredUint(
  values: Record<string, string | boolean>,
  key: string,
  label: string
): bigint | FailedValidation {
  const value = readGovernanceString(values, key);

  if (!value) {
    return failValidation(`请输入${label}`);
  }

  if (!/^\d+$/.test(value)) {
    return failValidation(`${label}必须是非负整数`);
  }

  return BigInt(value);
}

/**
 * @notice 解析必填且必须大于零的代币数量。
 * @param values 草稿字段值映射。
 * @param key 字段键名。
 * @param label 字段展示名称。
 * @returns 解析成功时返回 `bigint`，失败时返回校验错误。
 */
export function parseRequiredTokenAmount(
  values: Record<string, string | boolean>,
  key: string,
  label: string
): bigint | FailedValidation {
  const value = readGovernanceString(values, key);

  if (!value) {
    return failValidation(`请输入${label}`);
  }

  try {
    const parsed = parseEther(value);
    if (parsed <= 0n) {
      return failValidation(`${label}必须大于 0`);
    }
    return parsed;
  } catch {
    return failValidation(`${label}格式不正确`);
  }
}

/**
 * @notice 解析必填地址字段。
 * @param values 草稿字段值映射。
 * @param key 字段键名。
 * @param label 字段展示名称。
 * @returns 解析成功时返回地址，失败时返回校验错误。
 */
export function parseRequiredAddress(
  values: Record<string, string | boolean>,
  key: string,
  label: string
): Address | FailedValidation {
  const value = readGovernanceString(values, key);

  if (!value) {
    return failValidation(`请输入${label}`);
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return failValidation(`${label}格式不正确`);
  }

  return value as Address;
}

/**
 * @notice 解析必填且允许为零的代币数量。
 * @param values 草稿字段值映射。
 * @param key 字段键名。
 * @param label 字段展示名称。
 * @returns 解析成功时返回 `bigint`，失败时返回校验错误。
 */
export function parseRequiredNonNegativeTokenAmount(
  values: Record<string, string | boolean>,
  key: string,
  label: string
): bigint | FailedValidation {
  const value = readGovernanceString(values, key);

  if (!value) {
    return failValidation(`请输入${label}`);
  }

  try {
    const parsed = parseEther(value);
    if (parsed < 0n) {
      return failValidation(`${label}必须大于或等于 0`);
    }
    return parsed;
  } catch {
    return failValidation(`${label}格式不正确`);
  }
}

/**
 * @notice 将地址缩写成界面友好的短格式。
 * @param address 原始地址。
 * @returns 形如 `0x1234...abcd` 的短地址字符串。
 */
export function formatGovernanceAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * @notice 构造治理动作编码结果。
 * @param input 治理动作编码所需的全部输入。
 * @returns 可直接用于提案创建的治理动作对象。
 */
export function buildEncodedGovernanceAction(input: {
  templateId: string;
  target: Address;
  functionName: string;
  args?: readonly unknown[];
  title: string;
  description: string;
  riskLevel: GovernanceRiskLevel;
  abi: typeof ABIS.KnowledgeContent;
  value?: bigint;
}): GovernanceEncodedAction {
  return {
    templateId: input.templateId,
    target: input.target,
    value: input.value ?? 0n,
    calldata: encodeFunctionData({
      abi: input.abi,
      functionName: input.functionName,
      args: input.args,
    }) as HexString,
    title: input.title,
    description: input.description,
    riskLevel: input.riskLevel,
  };
}

/**
 * @notice 将代币数量格式化为带原生代币符号的展示文案。
 * @param amount 原始 `wei` 金额。
 * @returns 格式化后的金额字符串。
 */
export function formatGovernanceTokenAmount(amount: bigint) {
  return `${formatEther(amount)} ${BRANDING.nativeTokenSymbol}`;
}
