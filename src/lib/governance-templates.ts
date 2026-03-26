import {
  encodeFunctionData,
  formatEther,
  isAddress,
  keccak256,
  parseEther,
  stringToBytes,
  toHex,
} from "viem";

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

const TIMELOCK_ROLE_OPTIONS = [
  {
    label: "DEFAULT_ADMIN_ROLE",
    value: `0x${"00".repeat(32)}`,
  },
  {
    label: "PROPOSER_ROLE",
    value: keccak256(toHex(stringToBytes("PROPOSER_ROLE"))),
  },
  {
    label: "EXECUTOR_ROLE",
    value: keccak256(toHex(stringToBytes("EXECUTOR_ROLE"))),
  },
  {
    label: "CANCELLER_ROLE",
    value: keccak256(toHex(stringToBytes("CANCELLER_ROLE"))),
  },
  {
    label: "TIMELOCK_ADMIN_ROLE",
    value: keccak256(toHex(stringToBytes("TIMELOCK_ADMIN_ROLE"))),
  },
] as const;

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

function parseRequiredAddress(
  values: Record<string, string | boolean>,
  key: string,
  label: string
): Address | FailedValidation {
  const value = readString(values, key);

  if (!value) {
    return fail(`请输入${label}`);
  }

  if (!isAddress(value)) {
    return fail(`${label}不是有效地址`);
  }

  return value as Address;
}

function parseRequiredSelect(
  values: Record<string, string | boolean>,
  key: string,
  label: string,
  allowedValues: readonly string[]
): string | FailedValidation {
  const value = readString(values, key);

  if (!value) {
    return fail(`请输入${label}`);
  }

  if (!allowedValues.includes(value)) {
    return fail(`${label}不在允许范围内`);
  }

  return value;
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

const ALL_GOVERNANCE_TEMPLATES: GovernanceTemplateDefinition[] = [
  {
    id: "content.setRewardRules",
    category: "content",
    label: "Reward Rules",
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
    id: "content.setTreasury",
    category: "content",
    label: "Set Treasury",
    description: "更新内容合约的 Treasury 地址。",
    riskLevel: "medium",
    target: CONTRACTS.KnowledgeContent as Address,
    functionName: "setTreasury",
    valueMode: "fixedZero",
    fields: [
      {
        key: "treasury",
        label: "Treasury 地址",
        type: "address",
        required: true,
        placeholder: CONTRACTS.TreasuryNative,
        defaultValue: CONTRACTS.TreasuryNative,
      },
    ],
  },
  {
    id: "content.setAntiSybil",
    category: "content",
    label: "Set Anti-Sybil",
    description: "更新投票反女巫配置。",
    riskLevel: "medium",
    target: CONTRACTS.KnowledgeContent as Address,
    functionName: "setAntiSybil",
    valueMode: "fixedZero",
    fields: [
      {
        key: "votesContract",
        label: "Votes 合约地址",
        type: "address",
        required: true,
        placeholder: CONTRACTS.NativeVotes,
        defaultValue: CONTRACTS.NativeVotes,
      },
      {
        key: "minStakeToVote",
        label: "最小质押门槛",
        type: "tokenAmount",
        required: true,
        placeholder: "例如 1",
        defaultValue: "1",
      },
    ],
  },
  {
    id: "content.pause",
    category: "content",
    label: "Pause Content",
    description: "暂停内容注册和投票。",
    riskLevel: "high",
    target: CONTRACTS.KnowledgeContent as Address,
    functionName: "pause",
    valueMode: "fixedZero",
    fields: [],
  },
  {
    id: "content.unpause",
    category: "content",
    label: "Unpause Content",
    description: "恢复内容注册和投票。",
    riskLevel: "medium",
    target: CONTRACTS.KnowledgeContent as Address,
    functionName: "unpause",
    valueMode: "fixedZero",
    fields: [],
  },
  {
    id: "treasury.setBudget",
    category: "treasury",
    label: "Set Treasury Budget",
    description: "更新 Treasury 周期和预算。",
    riskLevel: "medium",
    target: CONTRACTS.TreasuryNative as Address,
    functionName: "setBudget",
    valueMode: "fixedZero",
    fields: [
      {
        key: "epochDuration",
        label: "周期时长(秒)",
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
    id: "treasury.setSpender",
    category: "treasury",
    label: "Set Treasury Spender",
    description: "更新可记账的 spender 权限。",
    riskLevel: "medium",
    target: CONTRACTS.TreasuryNative as Address,
    functionName: "setSpender",
    valueMode: "fixedZero",
    fields: [
      {
        key: "spender",
        label: "Spender 地址",
        type: "address",
        required: true,
        placeholder: CONTRACTS.KnowledgeContent,
        defaultValue: CONTRACTS.KnowledgeContent,
      },
      {
        key: "allowed",
        label: "是否允许",
        type: "boolean",
        required: true,
        defaultValue: true,
      },
    ],
  },
  {
    id: "treasury.pause",
    category: "treasury",
    label: "Pause Treasury",
    description: "暂停 Treasury 敏感操作。",
    riskLevel: "high",
    target: CONTRACTS.TreasuryNative as Address,
    functionName: "pause",
    valueMode: "fixedZero",
    fields: [],
  },
  {
    id: "treasury.unpause",
    category: "treasury",
    label: "Unpause Treasury",
    description: "恢复 Treasury 敏感操作。",
    riskLevel: "medium",
    target: CONTRACTS.TreasuryNative as Address,
    functionName: "unpause",
    valueMode: "fixedZero",
    fields: [],
  },
  {
    id: "governor.setProposalThreshold",
    category: "governor",
    label: "Set Proposal Threshold",
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
    label: "Set Voting Delay",
    description: "更新提案创建后的投票延迟。",
    riskLevel: "low",
    target: CONTRACTS.KnowledgeGovernor as Address,
    functionName: "setVotingDelay",
    valueMode: "fixedZero",
    fields: [
      {
        key: "votingDelay",
        label: "投票延迟(区块)",
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
    label: "Set Voting Period",
    description: "更新投票持续周期。",
    riskLevel: "low",
    target: CONTRACTS.KnowledgeGovernor as Address,
    functionName: "setVotingPeriod",
    valueMode: "fixedZero",
    fields: [
      {
        key: "votingPeriod",
        label: "投票周期(区块)",
        type: "uint256",
        required: true,
        placeholder: "例如 10",
        defaultValue: "10",
      },
    ],
  },
  {
    id: "governor.updateQuorumNumerator",
    category: "governor",
    label: "Update Quorum Numerator",
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
    id: "governor.updateTimelock",
    category: "governor",
    label: "Update Timelock",
    description: "更新 Governor 使用的 Timelock。",
    riskLevel: "high",
    target: CONTRACTS.KnowledgeGovernor as Address,
    functionName: "updateTimelock",
    valueMode: "fixedZero",
    fields: [
      {
        key: "timelock",
        label: "Timelock 地址",
        type: "address",
        required: true,
        placeholder: CONTRACTS.TimelockController,
        defaultValue: CONTRACTS.TimelockController,
      },
    ],
  },
  {
    id: "timelock.updateDelay",
    category: "timelock",
    label: "Update Timelock Delay",
    description: "更新 Timelock 的最小延迟。",
    riskLevel: "high",
    target: CONTRACTS.TimelockController as Address,
    functionName: "updateDelay",
    valueMode: "fixedZero",
    fields: [
      {
        key: "delaySeconds",
        label: "最小延迟(秒)",
        type: "uint256",
        required: true,
        placeholder: "例如 3600",
        defaultValue: "3600",
      },
    ],
  },
  {
    id: "timelock.grantRole",
    category: "timelock",
    label: "Grant Timelock Role",
    description: "向指定账户授予 Timelock 角色。",
    riskLevel: "high",
    target: CONTRACTS.TimelockController as Address,
    functionName: "grantRole",
    valueMode: "fixedZero",
    fields: [
      {
        key: "role",
        label: "角色",
        type: "select",
        required: true,
        defaultValue: TIMELOCK_ROLE_OPTIONS[1].value,
        options: TIMELOCK_ROLE_OPTIONS.map((option) => ({
          label: option.label,
          value: option.value,
        })),
      },
      {
        key: "account",
        label: "账户地址",
        type: "address",
        required: true,
        placeholder: CONTRACTS.KnowledgeGovernor,
      },
    ],
  },
  {
    id: "timelock.revokeRole",
    category: "timelock",
    label: "Revoke Timelock Role",
    description: "撤销指定账户的 Timelock 角色。",
    riskLevel: "high",
    target: CONTRACTS.TimelockController as Address,
    functionName: "revokeRole",
    valueMode: "fixedZero",
    fields: [
      {
        key: "role",
        label: "角色",
        type: "select",
        required: true,
        defaultValue: TIMELOCK_ROLE_OPTIONS[1].value,
        options: TIMELOCK_ROLE_OPTIONS.map((option) => ({
          label: option.label,
          value: option.value,
        })),
      },
      {
        key: "account",
        label: "账户地址",
        type: "address",
        required: true,
        placeholder: CONTRACTS.KnowledgeGovernor,
      },
    ],
  },
];

function isTemplateAvailable(template: GovernanceTemplateDefinition) {
  return !template.fields.some((field) => field.type === "address");
}

export const GOVERNANCE_TEMPLATES = ALL_GOVERNANCE_TEMPLATES.filter(
  isTemplateAvailable
);

const templateCodecs: Record<string, TemplateCodec> = {
  "content.setRewardRules": {
    validate(values) {
      const minVotesToReward = parseRequiredUint(values, "minVotesToReward", "最小获奖票数");
      if (isFailed(minVotesToReward)) return minVotesToReward;

      const rewardPerVote = parseRequiredTokenAmount(values, "rewardPerVote", "单票奖励");
      if (isFailed(rewardPerVote)) return rewardPerVote;

      return ok();
    },
    encode(values) {
      const minVotesToReward = parseRequiredUint(values, "minVotesToReward", "最小获奖票数");
      const rewardPerVote = parseRequiredTokenAmount(values, "rewardPerVote", "单票奖励");

      if (isFailed(minVotesToReward) || isFailed(rewardPerVote)) {
        throw new Error("Invalid reward rules draft");
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
  "content.setTreasury": {
    validate(values) {
      const treasury = parseRequiredAddress(values, "treasury", "Treasury 地址");
      return isFailed(treasury) ? treasury : ok();
    },
    encode(values) {
      const treasury = parseRequiredAddress(values, "treasury", "Treasury 地址");
      if (isFailed(treasury)) {
        throw new Error("Invalid treasury address");
      }

      return buildEncodedAction({
        templateId: "content.setTreasury",
        target: CONTRACTS.KnowledgeContent as Address,
        abi: ABIS.KnowledgeContent,
        functionName: "setTreasury",
        args: [treasury],
        title: "更新 Treasury 地址",
        description: `将内容合约的 Treasury 更新为 ${treasury}`,
        riskLevel: "medium",
      });
    },
  },
  "content.setAntiSybil": {
    validate(values) {
      const votesContract = parseRequiredAddress(values, "votesContract", "Votes 合约地址");
      if (isFailed(votesContract)) return votesContract;

      const minStakeToVote = parseRequiredTokenAmount(values, "minStakeToVote", "最小质押门槛");
      if (isFailed(minStakeToVote)) return minStakeToVote;

      return ok();
    },
    encode(values) {
      const votesContract = parseRequiredAddress(values, "votesContract", "Votes 合约地址");
      const minStakeToVote = parseRequiredTokenAmount(values, "minStakeToVote", "最小质押门槛");

      if (isFailed(votesContract) || isFailed(minStakeToVote)) {
        throw new Error("Invalid anti-sybil draft");
      }

      return buildEncodedAction({
        templateId: "content.setAntiSybil",
        target: CONTRACTS.KnowledgeContent as Address,
        abi: ABIS.KnowledgeContent,
        functionName: "setAntiSybil",
        args: [votesContract, minStakeToVote],
        title: "更新 Anti-Sybil 配置",
        description: `将 Votes 合约设为 ${votesContract}，最小质押门槛设为 ${formatEther(minStakeToVote)} ${BRANDING.nativeTokenSymbol}`,
        riskLevel: "medium",
      });
    },
  },
  "content.pause": {
    validate() {
      return ok();
    },
    encode() {
      return buildEncodedAction({
        templateId: "content.pause",
        target: CONTRACTS.KnowledgeContent as Address,
        abi: ABIS.KnowledgeContent,
        functionName: "pause",
        title: "暂停内容模块",
        description: "暂停内容注册、投票和奖励相关操作。",
        riskLevel: "high",
      });
    },
  },
  "content.unpause": {
    validate() {
      return ok();
    },
    encode() {
      return buildEncodedAction({
        templateId: "content.unpause",
        target: CONTRACTS.KnowledgeContent as Address,
        abi: ABIS.KnowledgeContent,
        functionName: "unpause",
        title: "恢复内容模块",
        description: "恢复内容注册、投票和奖励相关操作。",
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
        throw new Error("Invalid treasury budget draft");
      }

      return buildEncodedAction({
        templateId: "treasury.setBudget",
        target: CONTRACTS.TreasuryNative as Address,
        abi: ABIS.TreasuryNative,
        functionName: "setBudget",
        args: [epochDuration, epochBudget],
        title: "更新 Treasury 预算",
        description: `将周期时长设为 ${epochDuration.toString()} 秒，周期预算设为 ${formatEther(epochBudget)} ${BRANDING.nativeTokenSymbol}`,
        riskLevel: "medium",
      });
    },
  },
  "treasury.setSpender": {
    validate(values) {
      const spender = parseRequiredAddress(values, "spender", "Spender 地址");
      return isFailed(spender) ? spender : ok();
    },
    encode(values) {
      const spender = parseRequiredAddress(values, "spender", "Spender 地址");
      if (isFailed(spender)) {
        throw new Error("Invalid treasury spender draft");
      }

      const allowed = readBoolean(values, "allowed");

      return buildEncodedAction({
        templateId: "treasury.setSpender",
        target: CONTRACTS.TreasuryNative as Address,
        abi: ABIS.TreasuryNative,
        functionName: "setSpender",
        args: [spender, allowed],
        title: "更新 Treasury Spender 权限",
        description: `${allowed ? "授予" : "撤销"} ${spender} 的 spender 权限`,
        riskLevel: "medium",
      });
    },
  },
  "treasury.pause": {
    validate() {
      return ok();
    },
    encode() {
      return buildEncodedAction({
        templateId: "treasury.pause",
        target: CONTRACTS.TreasuryNative as Address,
        abi: ABIS.TreasuryNative,
        functionName: "pause",
        title: "暂停 Treasury",
        description: "暂停 Treasury 的敏感链上操作。",
        riskLevel: "high",
      });
    },
  },
  "treasury.unpause": {
    validate() {
      return ok();
    },
    encode() {
      return buildEncodedAction({
        templateId: "treasury.unpause",
        target: CONTRACTS.TreasuryNative as Address,
        abi: ABIS.TreasuryNative,
        functionName: "unpause",
        title: "恢复 Treasury",
        description: "恢复 Treasury 的敏感链上操作。",
        riskLevel: "medium",
      });
    },
  },
  "governor.setProposalThreshold": {
    validate(values) {
      const proposalThreshold = parseRequiredTokenAmount(values, "proposalThreshold", "提案门槛");
      return isFailed(proposalThreshold) ? proposalThreshold : ok();
    },
    encode(values) {
      const proposalThreshold = parseRequiredTokenAmount(values, "proposalThreshold", "提案门槛");
      if (isFailed(proposalThreshold)) {
        throw new Error("Invalid proposal threshold draft");
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
        throw new Error("Invalid voting delay draft");
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
        throw new Error("Invalid voting period draft");
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
  "governor.updateQuorumNumerator": {
    validate(values) {
      const quorumNumerator = parseRequiredUint(values, "quorumNumerator", "法定人数分子");
      return isFailed(quorumNumerator) ? quorumNumerator : ok();
    },
    encode(values) {
      const quorumNumerator = parseRequiredUint(values, "quorumNumerator", "法定人数分子");
      if (isFailed(quorumNumerator)) {
        throw new Error("Invalid quorum numerator draft");
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
  "governor.updateTimelock": {
    validate(values) {
      const timelock = parseRequiredAddress(values, "timelock", "Timelock 地址");
      return isFailed(timelock) ? timelock : ok();
    },
    encode(values) {
      const timelock = parseRequiredAddress(values, "timelock", "Timelock 地址");
      if (isFailed(timelock)) {
        throw new Error("Invalid timelock draft");
      }

      return buildEncodedAction({
        templateId: "governor.updateTimelock",
        target: CONTRACTS.KnowledgeGovernor as Address,
        abi: ABIS.KnowledgeGovernor,
        functionName: "updateTimelock",
        args: [timelock],
        title: "更新 Governor Timelock",
        description: `将 Governor 绑定的 Timelock 更新为 ${timelock}`,
        riskLevel: "high",
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
        throw new Error("Invalid timelock delay draft");
      }

      return buildEncodedAction({
        templateId: "timelock.updateDelay",
        target: CONTRACTS.TimelockController as Address,
        abi: ABIS.TimelockController,
        functionName: "updateDelay",
        args: [delaySeconds],
        title: "更新 Timelock 延迟",
        description: `将 Timelock 最小延迟更新为 ${delaySeconds.toString()} 秒`,
        riskLevel: "high",
      });
    },
  },
  "timelock.grantRole": {
    validate(values) {
      const role = parseRequiredSelect(
        values,
        "role",
        "角色",
        TIMELOCK_ROLE_OPTIONS.map((option) => option.value)
      );
      if (isFailed(role)) return role;

      const account = parseRequiredAddress(values, "account", "账户地址");
      return isFailed(account) ? account : ok();
    },
    encode(values) {
      const role = parseRequiredSelect(
        values,
        "role",
        "角色",
        TIMELOCK_ROLE_OPTIONS.map((option) => option.value)
      );
      const account = parseRequiredAddress(values, "account", "账户地址");

      if (isFailed(role) || isFailed(account)) {
        throw new Error("Invalid timelock grant role draft");
      }

      const roleLabel =
        TIMELOCK_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;

      return buildEncodedAction({
        templateId: "timelock.grantRole",
        target: CONTRACTS.TimelockController as Address,
        abi: ABIS.TimelockController,
        functionName: "grantRole",
        args: [role, account],
        title: "授予 Timelock 角色",
        description: `向 ${account} 授予 ${roleLabel}`,
        riskLevel: "high",
      });
    },
  },
  "timelock.revokeRole": {
    validate(values) {
      const role = parseRequiredSelect(
        values,
        "role",
        "角色",
        TIMELOCK_ROLE_OPTIONS.map((option) => option.value)
      );
      if (isFailed(role)) return role;

      const account = parseRequiredAddress(values, "account", "账户地址");
      return isFailed(account) ? account : ok();
    },
    encode(values) {
      const role = parseRequiredSelect(
        values,
        "role",
        "角色",
        TIMELOCK_ROLE_OPTIONS.map((option) => option.value)
      );
      const account = parseRequiredAddress(values, "account", "账户地址");

      if (isFailed(role) || isFailed(account)) {
        throw new Error("Invalid timelock revoke role draft");
      }

      const roleLabel =
        TIMELOCK_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;

      return buildEncodedAction({
        templateId: "timelock.revokeRole",
        target: CONTRACTS.TimelockController as Address,
        abi: ABIS.TimelockController,
        functionName: "revokeRole",
        args: [role, account],
        title: "撤销 Timelock 角色",
        description: `撤销 ${account} 的 ${roleLabel}`,
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
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
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
