import { formatEther } from "viem";

import { ABIS, CONTRACTS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import {
  buildEncodedGovernanceAction,
  createGovernanceDraftId,
  type FailedValidation as GovernanceFailedValidation,
  failValidation,
  formatGovernanceAddress,
  isFailedValidation,
  okValidation,
  parseRequiredAddress,
  parseRequiredNonNegativeTokenAmount,
  parseRequiredTokenAmount,
  parseRequiredUint,
  readGovernanceBoolean,
  readGovernanceString,
  type ValidationResult as GovernanceValidationResult,
} from "@/lib/governance-template-utils";
import type { Address, HexString } from "@/types/contracts";
import type {
  GovernanceDraftAction,
  GovernanceEncodedAction,
  GovernanceRiskLevel,
  GovernanceTemplateDefinition,
} from "@/types/governance";

type TemplateCodec = {
  validate: (
    values: Record<string, string | boolean>
  ) => ReturnType<typeof okValidation> | ReturnType<typeof failValidation>;
  encode: (values: Record<string, string | boolean>) => GovernanceEncodedAction;
};

type ValidationResult = GovernanceValidationResult;
type FailedValidation = GovernanceFailedValidation;

const createDraftId = createGovernanceDraftId;
const ok = okValidation;
const fail = failValidation;
const isFailed = isFailedValidation;
const readString = readGovernanceString;
const readBoolean = readGovernanceBoolean;
const formatAddress = formatGovernanceAddress;
const buildEncodedAction = buildEncodedGovernanceAction;

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
    id: "content.setContentFees",
    category: "content",
    label: "更新内容费用",
    description: "调整内容发布费与新版本更新费。",
    riskLevel: "medium",
    target: CONTRACTS.KnowledgeContent as Address,
    functionName: "setContentFees",
    valueMode: "fixedZero",
    fields: [
      {
        key: "registerFee",
        label: "发布费用",
        type: "tokenAmount",
        required: true,
        placeholder: "例如 0.01",
        defaultValue: "0.01",
      },
      {
        key: "updateFee",
        label: "更新费用",
        type: "tokenAmount",
        required: true,
        placeholder: "例如 0.005",
        defaultValue: "0.005",
      },
    ],
  },
  {
    id: "stake.setCooldownSeconds",
    category: "stake",
    label: "更新退出冷却期",
    description: "更新质押退出后的冷却时间。",
    riskLevel: "medium",
    target: CONTRACTS.NativeVotes as Address,
    functionName: "setCooldownSeconds",
    valueMode: "fixedZero",
    fields: [
      {
        key: "cooldownSeconds",
        label: "退出冷却期（秒）",
        type: "uint256",
        required: true,
        placeholder: "例如 3600",
        defaultValue: "3600",
      },
    ],
  },
  {
    id: "stake.setActivationBlocks",
    category: "stake",
    label: "更新质押激活延迟",
    description: "更新质押存入后获得投票权前的等待区块数。",
    riskLevel: "medium",
    target: CONTRACTS.NativeVotes as Address,
    functionName: "setActivationBlocks",
    valueMode: "fixedZero",
    fields: [
      {
        key: "activationBlocks",
        label: "激活延迟（区块）",
        type: "uint256",
        required: true,
        placeholder: "例如 10",
        defaultValue: "10",
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
    id: "revenueVault.setFaucetConfig",
    category: "treasury",
    label: "更新 Faucet 补充策略",
    description: "调整 RevenueVault 向 FaucetVault 的分账比例与自动补充阈值。",
    riskLevel: "medium",
    target: CONTRACTS.RevenueVault as Address,
    functionName: "setFaucetConfig",
    valueMode: "fixedZero",
    fields: [
      {
        key: "faucetWallet",
        label: "FaucetVault 地址",
        type: "address",
        required: true,
        placeholder: "0x...",
        defaultValue: (CONTRACTS.FaucetVault as string | undefined) ?? "",
      },
      {
        key: "faucetShareBps",
        label: "Faucet 分成基点",
        type: "uint256",
        required: true,
        placeholder: "例如 3000",
        defaultValue: "3000",
      },
      {
        key: "minFaucetPayout",
        label: "最小补充金额",
        type: "tokenAmount",
        required: true,
        placeholder: "例如 0.5",
        defaultValue: "0.5",
      },
      {
        key: "autoFaucetEnabled",
        label: "自动补充",
        type: "boolean",
        required: true,
        defaultValue: true,
      },
    ],
  },
  {
    id: "faucet.setSigner",
    category: "treasury",
    label: "轮换 Faucet 签名地址",
    description: "更新 Faucet 后端授权签名地址。",
    riskLevel: "high",
    target: CONTRACTS.FaucetVault as Address,
    functionName: "setSigner",
    valueMode: "fixedZero",
    fields: [
      {
        key: "signer",
        label: "新签名地址",
        type: "address",
        required: true,
        placeholder: "0x...",
      },
    ],
  },
  {
    id: "faucet.setClaimConfig",
    category: "treasury",
    label: "更新 Faucet 领取规则",
    description: "调整单次领取金额、余额门槛和领取冷却时间。",
    riskLevel: "medium",
    target: CONTRACTS.FaucetVault as Address,
    functionName: "setClaimConfig",
    valueMode: "fixedZero",
    fields: [
      {
        key: "claimAmount",
        label: "单次领取金额",
        type: "tokenAmount",
        required: true,
        placeholder: "例如 2",
        defaultValue: "2",
      },
      {
        key: "minAllowedBalance",
        label: "余额门槛",
        type: "tokenAmount",
        required: true,
        placeholder: "例如 1",
        defaultValue: "1",
      },
      {
        key: "claimCooldown",
        label: "领取冷却（秒）",
        type: "uint256",
        required: true,
        placeholder: "例如 86400",
        defaultValue: "86400",
      },
    ],
  },
  {
    id: "faucet.setBudgetConfig",
    category: "treasury",
    label: "更新 Faucet 周期预算",
    description: "调整 Faucet 的预算周期和周期总额度。",
    riskLevel: "medium",
    target: CONTRACTS.FaucetVault as Address,
    functionName: "setBudgetConfig",
    valueMode: "fixedZero",
    fields: [
      {
        key: "epochDuration",
        label: "预算周期（秒）",
        type: "uint256",
        required: true,
        placeholder: "例如 86400",
        defaultValue: "86400",
      },
      {
        key: "epochBudget",
        label: "周期预算",
        type: "tokenAmount",
        required: true,
        placeholder: "例如 20",
        defaultValue: "20",
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
    id: "governor.setProposalFee",
    category: "governor",
    label: "更新提案费用",
    description: "调整发起治理提案时需要附带的协议费用。",
    riskLevel: "medium",
    target: CONTRACTS.KnowledgeGovernor as Address,
    functionName: "setProposalFee",
    valueMode: "fixedZero",
    fields: [
      {
        key: "proposalFee",
        label: "提案费用",
        type: "tokenAmount",
        required: true,
        placeholder: "例如 0.05",
        defaultValue: "0.05",
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
  "content.setContentFees": {
    validate(values) {
      const registerFee = parseRequiredNonNegativeTokenAmount(
        values,
        "registerFee",
        "发布费用"
      );
      if (isFailed(registerFee)) return registerFee;

      const updateFee = parseRequiredNonNegativeTokenAmount(
        values,
        "updateFee",
        "更新费用"
      );
      if (isFailed(updateFee)) return updateFee;

      return ok();
    },
    encode(values) {
      const registerFee = parseRequiredNonNegativeTokenAmount(
        values,
        "registerFee",
        "发布费用"
      );
      const updateFee = parseRequiredNonNegativeTokenAmount(
        values,
        "updateFee",
        "更新费用"
      );

      if (isFailed(registerFee) || isFailed(updateFee)) {
        throw new Error("无效的内容费用提案");
      }

      return buildEncodedAction({
        templateId: "content.setContentFees",
        target: CONTRACTS.KnowledgeContent as Address,
        abi: ABIS.KnowledgeContent,
        functionName: "setContentFees",
        args: [registerFee, updateFee],
        title: "更新内容费用",
        description: `将发布费用设为 ${formatEther(registerFee)} ${BRANDING.nativeTokenSymbol}，更新费用设为 ${formatEther(updateFee)} ${BRANDING.nativeTokenSymbol}`,
        riskLevel: "medium",
      });
    },
  },
  "stake.setCooldownSeconds": {
    validate(values) {
      const cooldownSeconds = parseRequiredUint(
        values,
        "cooldownSeconds",
        "退出冷却期"
      );
      return isFailed(cooldownSeconds) ? cooldownSeconds : ok();
    },
    encode(values) {
      const cooldownSeconds = parseRequiredUint(
        values,
        "cooldownSeconds",
        "退出冷却期"
      );
      if (isFailed(cooldownSeconds)) {
        throw new Error("无效的退出冷却期提案");
      }

      return buildEncodedAction({
        templateId: "stake.setCooldownSeconds",
        target: CONTRACTS.NativeVotes as Address,
        abi: ABIS.NativeVotes,
        functionName: "setCooldownSeconds",
        args: [cooldownSeconds],
        title: "更新退出冷却期",
        description: `将退出冷却期更新为 ${cooldownSeconds.toString()} 秒`,
        riskLevel: "medium",
      });
    },
  },
  "stake.setActivationBlocks": {
    validate(values) {
      const activationBlocks = parseRequiredUint(
        values,
        "activationBlocks",
        "激活延迟"
      );
      return isFailed(activationBlocks) ? activationBlocks : ok();
    },
    encode(values) {
      const activationBlocks = parseRequiredUint(
        values,
        "activationBlocks",
        "激活延迟"
      );
      if (isFailed(activationBlocks)) {
        throw new Error("无效的质押激活延迟提案");
      }

      return buildEncodedAction({
        templateId: "stake.setActivationBlocks",
        target: CONTRACTS.NativeVotes as Address,
        abi: ABIS.NativeVotes,
        functionName: "setActivationBlocks",
        args: [activationBlocks],
        title: "更新质押激活延迟",
        description: `将质押激活延迟更新为 ${activationBlocks.toString()} 个区块`,
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
  "revenueVault.setFaucetConfig": {
    validate(values) {
      const faucetWallet = parseRequiredAddress(values, "faucetWallet", "FaucetVault 地址");
      if (isFailed(faucetWallet)) return faucetWallet;

      const faucetShareBps = parseRequiredUint(values, "faucetShareBps", "Faucet 分成基点");
      if (isFailed(faucetShareBps)) return faucetShareBps;

      const minFaucetPayout = parseRequiredTokenAmount(
        values,
        "minFaucetPayout",
        "最小补充金额"
      );
      if (isFailed(minFaucetPayout)) return minFaucetPayout;

      return ok();
    },
    encode(values) {
      const faucetWallet = parseRequiredAddress(values, "faucetWallet", "FaucetVault 地址");
      const faucetShareBps = parseRequiredUint(values, "faucetShareBps", "Faucet 分成基点");
      const minFaucetPayout = parseRequiredTokenAmount(
        values,
        "minFaucetPayout",
        "最小补充金额"
      );

      if (
        isFailed(faucetWallet) ||
        isFailed(faucetShareBps) ||
        isFailed(minFaucetPayout)
      ) {
        throw new Error("无效的 Faucet 补充策略提案");
      }

      const autoFaucetEnabled = readBoolean(values, "autoFaucetEnabled");

      return buildEncodedAction({
        templateId: "revenueVault.setFaucetConfig",
        target: CONTRACTS.RevenueVault as Address,
        abi: ABIS.RevenueVault,
        functionName: "setFaucetConfig",
        args: [
          faucetWallet,
          faucetShareBps,
          minFaucetPayout,
          autoFaucetEnabled,
        ],
        title: "更新 Faucet 补充策略",
        description: `将 Faucet 钱包更新为 ${formatAddress(faucetWallet)}，分成比例设为 ${faucetShareBps.toString()} bps，最小补充金额设为 ${formatEther(minFaucetPayout)} ${BRANDING.nativeTokenSymbol}，自动补充设为${autoFaucetEnabled ? "开启" : "关闭"}`,
        riskLevel: "medium",
      });
    },
  },
  "faucet.setSigner": {
    validate(values) {
      const signer = parseRequiredAddress(values, "signer", "新签名地址");
      return isFailed(signer) ? signer : ok();
    },
    encode(values) {
      const signer = parseRequiredAddress(values, "signer", "新签名地址");
      if (isFailed(signer)) {
        throw new Error("无效的 Faucet 签名地址提案");
      }

      return buildEncodedAction({
        templateId: "faucet.setSigner",
        target: CONTRACTS.FaucetVault as Address,
        abi: ABIS.FaucetVault,
        functionName: "setSigner",
        args: [signer],
        title: "轮换 Faucet 签名地址",
        description: `将 Faucet 授权签名地址更新为 ${formatAddress(signer)}`,
        riskLevel: "high",
      });
    },
  },
  "faucet.setClaimConfig": {
    validate(values) {
      const claimAmount = parseRequiredTokenAmount(values, "claimAmount", "单次领取金额");
      if (isFailed(claimAmount)) return claimAmount;

      const minAllowedBalance = parseRequiredTokenAmount(
        values,
        "minAllowedBalance",
        "余额门槛"
      );
      if (isFailed(minAllowedBalance)) return minAllowedBalance;

      const claimCooldown = parseRequiredUint(values, "claimCooldown", "领取冷却");
      return isFailed(claimCooldown) ? claimCooldown : ok();
    },
    encode(values) {
      const claimAmount = parseRequiredTokenAmount(values, "claimAmount", "单次领取金额");
      const minAllowedBalance = parseRequiredTokenAmount(
        values,
        "minAllowedBalance",
        "余额门槛"
      );
      const claimCooldown = parseRequiredUint(values, "claimCooldown", "领取冷却");

      if (
        isFailed(claimAmount) ||
        isFailed(minAllowedBalance) ||
        isFailed(claimCooldown)
      ) {
        throw new Error("无效的 Faucet 领取规则提案");
      }

      return buildEncodedAction({
        templateId: "faucet.setClaimConfig",
        target: CONTRACTS.FaucetVault as Address,
        abi: ABIS.FaucetVault,
        functionName: "setClaimConfig",
        args: [claimAmount, minAllowedBalance, claimCooldown],
        title: "更新 Faucet 领取规则",
        description: `将单次领取金额更新为 ${formatEther(claimAmount)} ${BRANDING.nativeTokenSymbol}，余额门槛更新为 ${formatEther(minAllowedBalance)} ${BRANDING.nativeTokenSymbol}，领取冷却更新为 ${claimCooldown.toString()} 秒`,
        riskLevel: "medium",
      });
    },
  },
  "faucet.setBudgetConfig": {
    validate(values) {
      const epochDuration = parseRequiredUint(values, "epochDuration", "预算周期");
      if (isFailed(epochDuration)) return epochDuration;

      const epochBudget = parseRequiredTokenAmount(values, "epochBudget", "周期预算");
      return isFailed(epochBudget) ? epochBudget : ok();
    },
    encode(values) {
      const epochDuration = parseRequiredUint(values, "epochDuration", "预算周期");
      const epochBudget = parseRequiredTokenAmount(values, "epochBudget", "周期预算");

      if (isFailed(epochDuration) || isFailed(epochBudget)) {
        throw new Error("无效的 Faucet 周期预算提案");
      }

      return buildEncodedAction({
        templateId: "faucet.setBudgetConfig",
        target: CONTRACTS.FaucetVault as Address,
        abi: ABIS.FaucetVault,
        functionName: "setBudgetConfig",
        args: [epochDuration, epochBudget],
        title: "更新 Faucet 周期预算",
        description: `将 Faucet 预算周期更新为 ${epochDuration.toString()} 秒，周期预算更新为 ${formatEther(epochBudget)} ${BRANDING.nativeTokenSymbol}`,
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
  "governor.setProposalFee": {
    validate(values) {
      const proposalFee = parseRequiredNonNegativeTokenAmount(
        values,
        "proposalFee",
        "提案费用"
      );
      return isFailed(proposalFee) ? proposalFee : ok();
    },
    encode(values) {
      const proposalFee = parseRequiredNonNegativeTokenAmount(
        values,
        "proposalFee",
        "提案费用"
      );

      if (isFailed(proposalFee)) {
        throw new Error("无效的提案费用提案");
      }

      return buildEncodedAction({
        templateId: "governor.setProposalFee",
        target: CONTRACTS.KnowledgeGovernor as Address,
        abi: ABIS.KnowledgeGovernor,
        functionName: "setProposalFee",
        args: [proposalFee],
        title: "更新提案费用",
        description: `将提案费用更新为 ${formatEther(proposalFee)} ${BRANDING.nativeTokenSymbol}`,
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

  return formatAddress(address);
}
