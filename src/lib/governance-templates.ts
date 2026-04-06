import { CONTRACTS } from "@/contracts";
import { GOVERNANCE_TEMPLATES } from "@/lib/governance-template-definitions";
import {
  createGovernanceDraftId,
  failValidation,
  formatGovernanceAddress,
  type ValidationResult as GovernanceValidationResult,
} from "@/lib/governance-template-utils";
import { templateCodecs } from "@/lib/governance-template-codecs";
import type { Address } from "@/types/contracts";
import type {
  GovernanceDraftAction,
  GovernanceRiskLevel,
} from "@/types/governance";

type ValidationResult = GovernanceValidationResult;

export function getGovernanceTemplates() {
  return GOVERNANCE_TEMPLATES;
}

export function getGovernanceTemplateById(templateId: string) {
  return GOVERNANCE_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function createGovernanceDraftAction(templateId = GOVERNANCE_TEMPLATES[0]?.id) {
  const template = templateId ? getGovernanceTemplateById(templateId) : null;

  return {
    id: createGovernanceDraftId(),
    templateId: template?.id ?? "",
    values: Object.fromEntries(
      (template?.fields ?? []).map((field) => [field.key, field.defaultValue ?? ""])
    ),
  } satisfies GovernanceDraftAction;
}

export function validateGovernanceActionDraft(
  draft: GovernanceDraftAction
): ValidationResult {
  const template = getGovernanceTemplateById(draft.templateId);

  if (!template) {
    return failValidation("请选择提案类型");
  }

  const codec = templateCodecs[draft.templateId];

  if (!codec) {
    return failValidation("该提案类型暂不支持编码");
  }

  return codec.validate(draft.values);
}

export function encodeGovernanceActionDraft(draft: GovernanceDraftAction) {
  const validation = validateGovernanceActionDraft(draft);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const codec = templateCodecs[draft.templateId];
  if (!codec) {
    throw new Error("Unsupported governance template");
  }

  return codec.encode(draft.values);
}

export function getRiskBadgeClass(riskLevel: GovernanceRiskLevel) {
  switch (riskLevel) {
    case "low":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
    case "high":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

export function getRiskLabel(riskLevel: GovernanceRiskLevel) {
  switch (riskLevel) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    default:
      return riskLevel;
  }
}

export function formatGovernanceTemplateTarget(address: Address) {
  if (address.toLowerCase() === CONTRACTS.NativeVotes.toLowerCase()) {
    return "NativeVotes";
  }

  if (address.toLowerCase() === CONTRACTS.KnowledgeContent.toLowerCase()) {
    return "KnowledgeContent";
  }

  if (address.toLowerCase() === CONTRACTS.TreasuryNative.toLowerCase()) {
    return "TreasuryNative";
  }

  if (address.toLowerCase() === CONTRACTS.KnowledgeGovernor.toLowerCase()) {
    return "KnowledgeGovernor";
  }

  if (address.toLowerCase() === CONTRACTS.TimelockController.toLowerCase()) {
    return "TimelockController";
  }

  return formatGovernanceAddress(address);
}
