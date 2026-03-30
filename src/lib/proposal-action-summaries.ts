import { decodeFunctionData, formatEther } from "viem";

import { ABIS, CONTRACTS } from "@/contracts";
import { BRANDING } from "@/lib/branding";
import type { Address, HexString } from "@/types/contracts";
import type { ProposalActionSummary, ProposalItem } from "@/types/governance";

function isSameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function getContractLabel(address: Address) {
  if (isSameAddress(address, CONTRACTS.KnowledgeContent)) return "KnowledgeContent";
  if (isSameAddress(address, CONTRACTS.TreasuryNative)) return "TreasuryNative";
  if (isSameAddress(address, CONTRACTS.KnowledgeGovernor)) return "KnowledgeGovernor";
  if (isSameAddress(address, CONTRACTS.TimelockController)) return "TimelockController";
  if (isSameAddress(address, CONTRACTS.NativeVotes)) return "NativeVotes";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatGenericArgument(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatGenericArgument(item)).join(", ")}]`;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function appendValueSuffix(description: string, value: bigint) {
  if (value === 0n) return description;
  return `${description}，并附带 ${formatEther(value)} ${BRANDING.nativeTokenSymbol}`;
}

function createSummary(input: ProposalActionSummary): ProposalActionSummary {
  return input;
}

function summarizeDecodedAction(
  target: Address,
  value: bigint,
  calldata: HexString
): ProposalActionSummary {
  const targetLabel = getContractLabel(target);

  try {
    if (isSameAddress(target, CONTRACTS.KnowledgeContent)) {
      const decoded = decodeFunctionData({
        abi: ABIS.KnowledgeContent,
        data: calldata,
      });
      const args = decoded.args ?? [];

      if (
        decoded.functionName === "setRewardRules" &&
        typeof args[0] === "bigint" &&
        typeof args[1] === "bigint"
      ) {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新奖励规则",
          description: appendValueSuffix(
            `将最小获奖票数设为 ${args[0].toString()}，单票奖励设为 ${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            value
          ),
          details: [
            { label: "最小获奖票数", value: args[0].toString() },
            {
              label: "单票奖励",
              value: `${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            },
          ],
          rawCalldata: calldata,
        });
      }

      if (
        decoded.functionName === "setContentPolicy" &&
        typeof args[0] === "bigint" &&
        typeof args[1] === "boolean" &&
        typeof args[2] === "bigint"
      ) {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新内容策略",
          description: appendValueSuffix(
            `将编辑锁定票数更新为 ${args[0].toString()}，投票后删除设为${args[1] ? "允许" : "禁止"}，单内容最大版本数设为 ${args[2].toString()}`,
            value
          ),
          details: [
            { label: "编辑锁定票数", value: args[0].toString() },
            { label: "投票后允许删除", value: args[1] ? "允许" : "禁止" },
            { label: "最大版本数", value: args[2].toString() },
          ],
          rawCalldata: calldata,
        });
      }

      if (
        decoded.functionName === "setContentFees" &&
        typeof args[0] === "bigint" &&
        typeof args[1] === "bigint"
      ) {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新内容费用",
          description: appendValueSuffix(
            `将发布费用更新为 ${formatEther(args[0])} ${BRANDING.nativeTokenSymbol}，更新费用更新为 ${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            value
          ),
          details: [
            {
              label: "发布费用",
              value: `${formatEther(args[0])} ${BRANDING.nativeTokenSymbol}`,
            },
            {
              label: "更新费用",
              value: `${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            },
          ],
          rawCalldata: calldata,
        });
      }
    }

    if (isSameAddress(target, CONTRACTS.TreasuryNative)) {
      const decoded = decodeFunctionData({
        abi: ABIS.TreasuryNative,
        data: calldata,
      });
      const args = decoded.args ?? [];

      if (
        decoded.functionName === "setBudget" &&
        typeof args[0] === "bigint" &&
        typeof args[1] === "bigint"
      ) {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新金库预算",
          description: appendValueSuffix(
            `将周期时长设为 ${args[0].toString()} 秒，周期预算设为 ${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            value
          ),
          details: [
            { label: "周期时长", value: `${args[0].toString()} 秒` },
            {
              label: "周期预算",
              value: `${formatEther(args[1])} ${BRANDING.nativeTokenSymbol}`,
            },
          ],
          rawCalldata: calldata,
        });
      }
    }

    if (isSameAddress(target, CONTRACTS.NativeVotes)) {
      const decoded = decodeFunctionData({
        abi: ABIS.NativeVotes,
        data: calldata,
      });
      const args = decoded.args ?? [];

      if (decoded.functionName === "setCooldownSeconds" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新退出冷却期",
          description: appendValueSuffix(
            `将退出冷却期更新为 ${args[0].toString()} 秒`,
            value
          ),
          details: [{ label: "退出冷却期", value: `${args[0].toString()} 秒` }],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "setActivationBlocks" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新质押激活延迟",
          description: appendValueSuffix(
            `将质押激活延迟更新为 ${args[0].toString()} 个区块`,
            value
          ),
          details: [{ label: "激活延迟", value: `${args[0].toString()} 个区块` }],
          rawCalldata: calldata,
        });
      }
    }

    if (isSameAddress(target, CONTRACTS.KnowledgeGovernor)) {
      const decoded = decodeFunctionData({
        abi: ABIS.KnowledgeGovernor,
        data: calldata,
      });
      const args = decoded.args ?? [];

      if (decoded.functionName === "setProposalThreshold" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新提案门槛",
          description: appendValueSuffix(
            `将提案门槛更新为 ${formatEther(args[0])} ${BRANDING.nativeTokenSymbol}`,
            value
          ),
          details: [
            {
              label: "提案门槛",
              value: `${formatEther(args[0])} ${BRANDING.nativeTokenSymbol}`,
            },
          ],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "setProposalFee" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新提案费用",
          description: appendValueSuffix(
            `将提案费用更新为 ${formatEther(args[0])} ${BRANDING.nativeTokenSymbol}`,
            value
          ),
          details: [
            {
              label: "提案费用",
              value: `${formatEther(args[0])} ${BRANDING.nativeTokenSymbol}`,
            },
          ],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "setVotingDelay" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新投票延迟",
          description: appendValueSuffix(
            `将投票延迟更新为 ${args[0].toString()} 个区块`,
            value
          ),
          details: [{ label: "投票延迟", value: `${args[0].toString()} 个区块` }],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "setVotingPeriod" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新投票周期",
          description: appendValueSuffix(
            `将投票周期更新为 ${args[0].toString()} 个区块`,
            value
          ),
          details: [{ label: "投票周期", value: `${args[0].toString()} 个区块` }],
          rawCalldata: calldata,
        });
      }

      if (
        decoded.functionName === "setLateQuorumVoteExtension" &&
        typeof args[0] === "bigint"
      ) {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新延迟法定人数延长期",
          description: appendValueSuffix(
            `将延迟法定人数延长期更新为 ${args[0].toString()} 个区块`,
            value
          ),
          details: [
            {
              label: "延迟法定人数延长期",
              value: `${args[0].toString()} 个区块`,
            },
          ],
          rawCalldata: calldata,
        });
      }

      if (decoded.functionName === "updateQuorumNumerator" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新法定人数分子",
          description: appendValueSuffix(`将法定人数分子更新为 ${args[0].toString()}`, value),
          details: [{ label: "法定人数分子", value: args[0].toString() }],
          rawCalldata: calldata,
        });
      }
    }

    if (isSameAddress(target, CONTRACTS.TimelockController)) {
      const decoded = decodeFunctionData({
        abi: ABIS.TimelockController,
        data: calldata,
      });
      const args = decoded.args ?? [];

      if (decoded.functionName === "updateDelay" && typeof args[0] === "bigint") {
        return createSummary({
          target,
          targetLabel,
          value,
          functionName: decoded.functionName,
          title: "更新时间锁延迟",
          description: appendValueSuffix(
            `将时间锁最小延迟更新为 ${args[0].toString()} 秒`,
            value
          ),
          details: [{ label: "最小延迟", value: `${args[0].toString()} 秒` }],
          rawCalldata: calldata,
        });
      }
    }

    const abi =
      isSameAddress(target, CONTRACTS.KnowledgeContent)
        ? ABIS.KnowledgeContent
        : isSameAddress(target, CONTRACTS.NativeVotes)
          ? ABIS.NativeVotes
          : isSameAddress(target, CONTRACTS.TreasuryNative)
            ? ABIS.TreasuryNative
            : isSameAddress(target, CONTRACTS.KnowledgeGovernor)
              ? ABIS.KnowledgeGovernor
              : isSameAddress(target, CONTRACTS.TimelockController)
                ? ABIS.TimelockController
                : null;

    if (abi) {
      const decoded = decodeFunctionData({
        abi,
        data: calldata,
      });
      const args = decoded.args ?? [];

      return createSummary({
        target,
        targetLabel,
        value,
        functionName: decoded.functionName,
        title: `调用 ${targetLabel}.${decoded.functionName}`,
        description: appendValueSuffix(
          `参数：${args.map((arg) => formatGenericArgument(arg)).join("，") || "无"}`,
          value
        ),
        details: args.map((arg, index) => ({
          label: `参数 ${index + 1}`,
          value: formatGenericArgument(arg),
        })),
        rawCalldata: calldata,
      });
    }
  } catch {
    // Fall through to unknown summary.
  }

  return createSummary({
    target,
    targetLabel,
    value,
    functionName: "unknown",
    title: `调用 ${targetLabel}`,
    description: appendValueSuffix("暂时无法解码该提案动作，下面保留原始 calldata", value),
    rawCalldata: calldata,
  });
}

export function summarizeProposalActions(
  proposal: Pick<ProposalItem, "targets" | "values" | "calldatas">
): ProposalActionSummary[] {
  return proposal.targets.map((target, index) =>
    summarizeDecodedAction(
      target,
      proposal.values[index] ?? 0n,
      proposal.calldatas[index] ?? "0x"
    )
  );
}
