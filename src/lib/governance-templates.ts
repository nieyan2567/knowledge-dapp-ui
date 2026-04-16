/**
 * @file 治理模板聚合模块。
 * @description 提供治理模板列表、草稿初始化、校验编码和风险展示等统一入口。
 */
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

/**
 * @notice 返回前端可用的全部治理模板定义。
 * @returns 治理模板定义数组。
 */
export function getGovernanceTemplates() {
  return GOVERNANCE_TEMPLATES;
}

/**
 * @notice 按模板标识查找单个治理模板。
 * @param templateId 模板唯一标识。
 * @returns 命中的模板定义；未命中时返回 `null`。
 */
export function getGovernanceTemplateById(templateId: string) {
  return GOVERNANCE_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

/**
 * @notice 基于模板默认值创建一条新的治理动作草稿。
 * @param templateId 要初始化的模板标识；未传时默认使用首个模板。
 * @returns 预填充完成的治理动作草稿对象。
 */
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

/**
 * @notice 校验治理动作草稿是否满足模板要求。
 * @param draft 待校验的治理动作草稿。
 * @returns 校验结果；成功时仅返回 `ok: true`，失败时附带错误信息。
 */
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

/**
 * @notice 将治理动作草稿编码成链上可执行的提案动作。
 * @param draft 待编码的治理动作草稿。
 * @returns 编码后的治理动作。
 * @throws 当草稿校验失败或模板缺少编码器时抛出异常。
 */
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

/**
 * @notice 根据风险等级返回徽标样式类名。
 * @param riskLevel 风险等级。
 * @returns 对应的 Tailwind 样式类名。
 */
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

/**
 * @notice 将风险等级转换为界面展示文案。
 * @param riskLevel 风险等级。
 * @returns 风险等级标签。
 */
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

/**
 * @notice 将治理目标合约地址格式化为已知合约名称或短地址。
 * @param address 治理动作目标合约地址。
 * @returns 目标合约的展示名称。
 */
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
