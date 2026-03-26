import { encodeFunctionData, formatEther, parseEther } from "viem";

import { ABIS, CONTRACTS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import type { Address, HexString } from "@/types/contracts";
import type {
  GovernanceDraftAction,
  GovernanceEncodedAction,
  GovernanceRiskLevel,
  GovernanceTemplateDefinition,
} from "@/types/governance";

type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

type FailedValidation = Extract<ValidationResult, { ok: false }>;

type TemplateCodec = {
  validate: (values: Record<string, string | boolean>) => ValidationResult;
  encode: (values: Record<string, string | boolean>) => GovernanceEncodedAction;
};

function createDraftId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ok(): ValidationResult {
  return { ok: true };
}

function fail(error: string): FailedValidation {
  return { ok: false, error };
}

function isFailed(
  value: unknown
): value is Extract<ValidationResult, { ok: false }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === false
  );
}

function readString(
  values: Record<string, string | boolean>,
  key: string
): string {
  const value = values[key];
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(
  values: Record<string, string | boolean>,
  key: string
): boolean {
  const value = values[key];

  if (typeof value === "boolean") {
    return value;
  }

  return value === "true";
}

function parseRequiredUint(
  values: Record<string, string | boolean>,
  key: string,
  label: string
): bigint | FailedValidation {
  const value = readString(values, key);

  if (!value) {
    return fail(`请输入${label}`);
  }

  if (!/^\d+$/.test(value)) {
    return fail(`${label}必须是非负整数`);
  }

  return BigInt(value);
}

function parseRequiredTokenAmount(
  values: Record<string, string | boolean>,
  key: string,
  label: string
): bigint | FailedValidation {
  const value = readString(values, key);

  if (!value) {
    return fail(`请输入${label}`);
  }

  try {
    const parsed = parseEther(value);
    if (parsed <= 0n) {
      return fail(`${label}必须大于 0`);
    }
    return parsed;
  } catch {
    return fail(`${label}格式不正确`);
  }
}

function formatAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function buildEncodedAction(input: {
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

const GOVERNANCE_TEMPLATES: GovernanceTemplateDefinition[] = [
  {
    id: "content.setRewardRules",
    category: "content",
    label: "更新奖励规则",
    description: "更新内容奖励规则。",
    riskLevel: "low",
    target: CONTRACTS.KnowledgeContent as Address,
    functionName: "setRewardRules",
    valueMode: "fixedZero",
    fields: [
      {
        key: "minVotesToReward",
        label: "最小获奖票数",
        type: "uint256",
        required: true,
        placeholder: "例如 10",
        defaultValue: "10",
      },
      {
        key: "rewardPerVote",
        label: "单票奖励",
        type: "tokenAmount",
        required: true,
        placeholder: "例如 0.001",
        defaultValue: "0.001",
      },
    ],
  },
  {
    id: "content.setContentPolicy",
    category: "content",
    label: "更新内容策略",
    description: "更新内容编辑锁定、删除策略和版本上限。",
    riskLevel: "medium",
    target: CONTRACTS.KnowledgeContent as Address,
    functionName: "setContentPolicy",
    valueMode: "fixedZero",
    fields: [
      {
        key: "editLockVotes",
        label: "编辑锁定票数",
        type: "uint256",
        required: true,
        placeholder: "例如 1",
        defaultValue: "1",
      },
      {
        key: "allowDeleteAfterVote",
        label: "投票后允许删除",
        type: "boolean",
        required: true,
        defaultValue: false,
      },
      {
        key: "maxVersionsPerContent",
        label: "单内容最大版本数",
        type: "uint256",
        required: true,
        placeholder: "例如 20",
        defaultValue: "20",
      },
    ],
  },
  {
    id: "treasury.setBudget",
    category: "treasury",
    label: "更新金库预算",
    description: "更新金库周期和预算。",
    riskLevel: "medium",
    target: CONTRACTS.TreasuryNative as Address,
    functionName: "setBudget",
    valueMode: "fixedZero",
    fields: [
      {
        key: "epochDuration",
        label: "周期时长（秒）",
        type: "uint256",
        required: true,
        placeholder: "例如 604800",
        defaultValue: "604800",
      },
      {
        key: "epochBudget",
        label: "周期预算",
        type: "tokenAmount",
        required: true,
        placeholder: "例如 100",
        defaultValue: "100",
      },
    ],
  },
  {
    id: "governor.setProposalThreshold",
    category: "governor",
    label: "更新提案门槛",
    description: "更新提案门槛。",
    riskLevel: "medium",
    target: CONTRACTS.KnowledgeGovernor as Address,
    functionName: "setProposalThreshold",
    valueMode: "fixedZero",
    fields: [
      {
        key: "proposalThreshold",
        label: "提案门槛",
        type: "tokenAmount",
        required: true,
        placeholder: "例如 100",
        defaultValue: "100",
      },
    ],
  },
  {
    id: "governor.setVotingDelay",
    category: "governor",
    label: "更新投票延迟",
    description: "更新提案创建后的投票延迟。",
    riskLevel: "low",
    target: CONTRACTS.KnowledgeGovernor as Address,
    functionName: "setVotingDelay",
    valueMode: "fixedZero",
    fields: [
      {
        key: "votingDelay",
        label: "投票延迟（区块）",
        type: "uint256",
        required: true,
        placeholder: "例如 1",
        defaultValue: "1",
      },
    ],
  },
  {
    id: "governor.setVotingPeriod",
    category: "governor",
    label: "更新投票周期",
    description: "更新投票持续周期。",
    riskLevel: "low",
    target: CONTRACTS.KnowledgeGovernor as Address,
    functionName: "setVotingPeriod",
    valueMode: "fixedZero",
    fields: [
      {
        key: "votingPeriod",
        label: "投票周期（区块）",
        type: "uint256",
        required: true,
        placeholder: "例如 10",
        defaultValue: "10",
      },
    ],
  },
  {
    id: "governor.setLateQuorumVoteExtension",
    category: "governor",
    label: "更新延迟法定人数延长期",
    description: "更新在法定人数较晚达成时追加的投票延长期。",
    riskLevel: "medium",
    target: CONTRACTS.KnowledgeGovernor as Address,
    functionName: "setLateQuorumVoteExtension",
    valueMode: "fixedZero",
    fields: [
      {
        key: "lateQuorumVoteExtension",
        label: "延迟法定人数延长期（区块）",
        type: "uint256",
        required: true,
        placeholder: "例如 20",
        defaultValue: "20",
      },
    ],
  },
  {
    id: "governor.updateQuorumNumerator",
    category: "governor",
    label: "更新法定人数分子",
    description: "更新法定人数分子。",
    riskLevel: "medium",
    target: CONTRACTS.KnowledgeGovernor as Address,
    functionName: "updateQuorumNumerator",
    valueMode: "fixedZero",
    fields: [
      {
        key: "quorumNumerator",
        label: "法定人数分子",
        type: "uint256",
        required: true,
        placeholder: "例如 4",
        defaultValue: "4",
      },
    ],
  },
  {
    id: "timelock.updateDelay",
    category: "timelock",
    label: "更新时间锁延迟",
    description: "更新时间锁的最小延迟。",
    riskLevel: "high",
    target: CONTRACTS.TimelockController as Address,
    functionName: "updateDelay",
    valueMode: "fixedZero",
    fields: [
      {
        key: "delaySeconds",
        label: "最小延迟（秒）",
        type: "uint256",
        required: true,
        placeholder: "例如 3600",
        defaultValue: "3600",
      },
    ],
  },
];

const templateCodecs: Record<string, TemplateCodec> = {
  "content.setRewardRules": {
    validate(values) {
      const minVotesToReward = parseRequiredUint(
        values,
        "minVotesToReward",
        "最小获奖票数"
      );
      if (isFailed(minVotesToReward)) return minVotesToReward;

      const rewardPerVote = parseRequiredTokenAmount(
        values,
        "rewardPerVote",
        "单票奖励"
      );
      if (isFailed(rewardPerVote)) return rewardPerVote;

      return ok();
    },
    encode(values) {
      const minVotesToReward = parseRequiredUint(
        values,
        "minVotesToReward",
        "最小获奖票数"
      );
      const rewardPerVote = parseRequiredTokenAmount(
        values,
        "rewardPerVote",
        "单票奖励"
      );

      if (isFailed(minVotesToReward) || isFailed(rewardPerVote)) {
        throw new Error("无效的奖励规则提案");
      }

      return buildEncodedAction({
        templateId: "content.setRewardRules",
        target: CONTRACTS.KnowledgeContent as Address,
        abi: ABIS.KnowledgeContent,
        functionName: "setRewardRules",
        args: [minVotesToReward, rewardPerVote],
        title: "更新奖励规则",
        description: `将最小获奖票数设为 ${minVotesToReward.toString()}，单票奖励设为 ${formatEther(rewardPerVote)} ${BRANDING.nativeTokenSymbol}`,
        riskLevel: "low",
      });
    },
  },
  "content.setContentPolicy": {
    validate(values) {
      const editLockVotes = parseRequiredUint(
        values,
        "editLockVotes",
        "编辑锁定票数"
      );
      if (isFailed(editLockVotes)) return editLockVotes;

      const maxVersionsPerContent = parseRequiredUint(
        values,
        "maxVersionsPerContent",
        "单内容最大版本数"
      );
      if (isFailed(maxVersionsPerContent)) return maxVersionsPerContent;

      return ok();
    },
    encode(values) {
      const editLockVotes = parseRequiredUint(
        values,
        "editLockVotes",
        "编辑锁定票数"
      );
      const maxVersionsPerContent = parseRequiredUint(
        values,
        "maxVersionsPerContent",
        "单内容最大版本数"
      );

      if (isFailed(editLockVotes) || isFailed(maxVersionsPerContent)) {
        throw new Error("无效的内容策略提案");
      }

      const allowDeleteAfterVote = readBoolean(values, "allowDeleteAfterVote");

      return buildEncodedAction({
        templateId: "content.setContentPolicy",
        target: CONTRACTS.KnowledgeContent as Address,
        abi: ABIS.KnowledgeContent,
        functionName: "setContentPolicy",
        args: [editLockVotes, allowDeleteAfterVote, maxVersionsPerContent],
        title: "更新内容策略",
        description: `将编辑锁定票数设为 ${editLockVotes.toString()}，投票后删除设为${allowDeleteAfterVote ? "允许" : "禁止"}，单内容最大版本数设为 ${maxVersionsPerContent.toString()}`,
        riskLevel: "medium",
      });
    },
  },
  "treasury.setBudget": {
    validate(values) {
      const epochDuration = parseRequiredUint(values, "epochDuration", "周期时长");
      if (isFailed(epochDuration)) return epochDuration;

      const epochBudget = parseRequiredTokenAmount(values, "epochBudget", "周期预算");
      if (isFailed(epochBudget)) return epochBudget;

      return ok();
    },
    encode(values) {
      const epochDuration = parseRequiredUint(values, "epochDuration", "周期时长");
      const epochBudget = parseRequiredTokenAmount(values, "epochBudget", "周期预算");

      if (isFailed(epochDuration) || isFailed(epochBudget)) {
        throw new Error("无效的金库预算提案");
      }

      return buildEncodedAction({
        templateId: "treasury.setBudget",
        target: CONTRACTS.TreasuryNative as Address,
        abi: ABIS.TreasuryNative,
        functionName: "setBudget",
        args: [epochDuration, epochBudget],
        title: "更新金库预算",
        description: `将周期时长设为 ${epochDuration.toString()} 秒，周期预算设为 ${formatEther(epochBudget)} ${BRANDING.nativeTokenSymbol}`,
        riskLevel: "medium",
      });
    },
  },
  "governor.setProposalThreshold": {
    validate(values) {
      const proposalThreshold = parseRequiredTokenAmount(
        values,
        "proposalThreshold",
        "提案门槛"
      );
      return isFailed(proposalThreshold) ? proposalThreshold : ok();
    },
    encode(values) {
      const proposalThreshold = parseRequiredTokenAmount(
        values,
        "proposalThreshold",
        "提案门槛"
      );
      if (isFailed(proposalThreshold)) {
        throw new Error("无效的提案门槛提案");
      }

      return buildEncodedAction({
        templateId: "governor.setProposalThreshold",
        target: CONTRACTS.KnowledgeGovernor as Address,
        abi: ABIS.KnowledgeGovernor,
        functionName: "setProposalThreshold",
        args: [proposalThreshold],
        title: "更新提案门槛",
        description: `将提案门槛更新为 ${formatEther(proposalThreshold)} ${BRANDING.nativeTokenSymbol}`,
        riskLevel: "medium",
      });
    },
  },
  "governor.setVotingDelay": {
    validate(values) {
      const votingDelay = parseRequiredUint(values, "votingDelay", "投票延迟");
      return isFailed(votingDelay) ? votingDelay : ok();
    },
    encode(values) {
      const votingDelay = parseRequiredUint(values, "votingDelay", "投票延迟");
      if (isFailed(votingDelay)) {
        throw new Error("无效的投票延迟提案");
      }

      return buildEncodedAction({
        templateId: "governor.setVotingDelay",
        target: CONTRACTS.KnowledgeGovernor as Address,
        abi: ABIS.KnowledgeGovernor,
        functionName: "setVotingDelay",
        args: [votingDelay],
        title: "更新投票延迟",
        description: `将投票延迟更新为 ${votingDelay.toString()} 个区块`,
        riskLevel: "low",
      });
    },
  },
  "governor.setVotingPeriod": {
    validate(values) {
      const votingPeriod = parseRequiredUint(values, "votingPeriod", "投票周期");
      return isFailed(votingPeriod) ? votingPeriod : ok();
    },
    encode(values) {
      const votingPeriod = parseRequiredUint(values, "votingPeriod", "投票周期");
      if (isFailed(votingPeriod)) {
        throw new Error("无效的投票周期提案");
      }

      return buildEncodedAction({
        templateId: "governor.setVotingPeriod",
        target: CONTRACTS.KnowledgeGovernor as Address,
        abi: ABIS.KnowledgeGovernor,
        functionName: "setVotingPeriod",
        args: [votingPeriod],
        title: "更新投票周期",
        description: `将投票周期更新为 ${votingPeriod.toString()} 个区块`,
        riskLevel: "low",
      });
    },
  },
  "governor.setLateQuorumVoteExtension": {
    validate(values) {
      const lateQuorumVoteExtension = parseRequiredUint(
        values,
        "lateQuorumVoteExtension",
        "延迟法定人数延长期"
      );
      return isFailed(lateQuorumVoteExtension) ? lateQuorumVoteExtension : ok();
    },
    encode(values) {
      const lateQuorumVoteExtension = parseRequiredUint(
        values,
        "lateQuorumVoteExtension",
        "延迟法定人数延长期"
      );
      if (isFailed(lateQuorumVoteExtension)) {
        throw new Error("无效的延迟法定人数延长期提案");
      }

      return buildEncodedAction({
        templateId: "governor.setLateQuorumVoteExtension",
        target: CONTRACTS.KnowledgeGovernor as Address,
        abi: ABIS.KnowledgeGovernor,
        functionName: "setLateQuorumVoteExtension",
        args: [lateQuorumVoteExtension],
        title: "更新延迟法定人数延长期",
        description: `将延迟法定人数延长期更新为 ${lateQuorumVoteExtension.toString()} 个区块`,
        riskLevel: "medium",
      });
    },
  },
  "governor.updateQuorumNumerator": {
    validate(values) {
      const quorumNumerator = parseRequiredUint(
        values,
        "quorumNumerator",
        "法定人数分子"
      );
      return isFailed(quorumNumerator) ? quorumNumerator : ok();
    },
    encode(values) {
      const quorumNumerator = parseRequiredUint(
        values,
        "quorumNumerator",
        "法定人数分子"
      );
      if (isFailed(quorumNumerator)) {
        throw new Error("无效的法定人数分子提案");
      }

      return buildEncodedAction({
        templateId: "governor.updateQuorumNumerator",
        target: CONTRACTS.KnowledgeGovernor as Address,
        abi: ABIS.KnowledgeGovernor,
        functionName: "updateQuorumNumerator",
        args: [quorumNumerator],
        title: "更新法定人数分子",
        description: `将法定人数分子更新为 ${quorumNumerator.toString()}`,
        riskLevel: "medium",
      });
    },
  },
  "timelock.updateDelay": {
    validate(values) {
      const delaySeconds = parseRequiredUint(values, "delaySeconds", "最小延迟");
      return isFailed(delaySeconds) ? delaySeconds : ok();
    },
    encode(values) {
      const delaySeconds = parseRequiredUint(values, "delaySeconds", "最小延迟");
      if (isFailed(delaySeconds)) {
        throw new Error("无效的时间锁延迟提案");
      }

      return buildEncodedAction({
        templateId: "timelock.updateDelay",
        target: CONTRACTS.TimelockController as Address,
        abi: ABIS.TimelockController,
        functionName: "updateDelay",
        args: [delaySeconds],
        title: "更新时间锁延迟",
        description: `将时间锁最小延迟更新为 ${delaySeconds.toString()} 秒`,
        riskLevel: "high",
      });
    },
  },
};

export function getGovernanceTemplates() {
  return GOVERNANCE_TEMPLATES;
}

export function getGovernanceTemplateById(templateId: string) {
  return GOVERNANCE_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function createGovernanceDraftAction(templateId = GOVERNANCE_TEMPLATES[0]?.id) {
  const template = templateId ? getGovernanceTemplateById(templateId) : null;

  return {
    id: createDraftId(),
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
    return fail("请选择提案类型");
  }

  const codec = templateCodecs[draft.templateId];

  if (!codec) {
    return fail("该提案类型暂不支持编码");
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

  return formatAddress(address);
}
