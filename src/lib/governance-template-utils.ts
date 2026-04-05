import { encodeFunctionData, formatEther, parseEther } from "viem";

import { ABIS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import type { Address, HexString } from "@/types/contracts";
import type {
  GovernanceEncodedAction,
  GovernanceRiskLevel,
} from "@/types/governance";

export type ValidationResult = { ok: true } | { ok: false; error: string };
export type FailedValidation = Extract<ValidationResult, { ok: false }>;

export function createGovernanceDraftId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function okValidation(): ValidationResult {
  return { ok: true };
}

export function failValidation(error: string): FailedValidation {
  return { ok: false, error };
}

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

export function readGovernanceString(
  values: Record<string, string | boolean>,
  key: string
) {
  const value = values[key];
  return typeof value === "string" ? value.trim() : "";
}

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

export function formatGovernanceAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

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

export function formatGovernanceTokenAmount(amount: bigint) {
  return `${formatEther(amount)} ${BRANDING.nativeTokenSymbol}`;
}
