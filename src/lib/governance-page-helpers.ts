import type {
  GovernanceTemplateCategory,
  GovernanceTemplateDefinition,
  ProposalItem,
} from "@/types/governance";

export const MAX_GOVERNANCE_DRAFT_ACTIONS = 5;

export type GovernanceGroupedTemplates = Array<
  [GovernanceTemplateCategory, GovernanceTemplateDefinition[]]
>;

export const GOVERNANCE_CATEGORY_LABELS: Record<
  GovernanceTemplateCategory,
  string
> = {
  content: "Content",
  stake: "Stake",
  treasury: "Treasury",
  governor: "Governor",
  timelock: "Timelock",
};

export const GOVERNANCE_FLOW_STEPS = [
  {
    step: 1,
    title: "配置提案动作",
    description: "从治理模板中组合链上动作，明确要修改的规则与参数。",
  },
  {
    step: 2,
    title: "提交并进入投票",
    description: "提案达到门槛后发起，经过 voting delay 后进入投票阶段。",
  },
  {
    step: 3,
    title: "通过后排队",
    description: "成功提案会进入 Timelock 队列，等待最小延迟结束。",
  },
  {
    step: 4,
    title: "执行生效",
    description: "队列完成后执行提案，治理参数和系统配置正式更新。",
  },
] as const;

export const GOVERNANCE_PAGE_COPY = {
  headerTitle: "Governance Center",
  headerDescription:
    "在同一页面查看治理流程、浏览提案、核对参数，并完成提案创建与提交前确认。",
  listTitle: "提案列表",
  listDescription:
    "这里集中展示全部治理提案，支持滚动浏览状态、投票进度与后续处理阶段。",
  createTitle: "创建提案",
  createDescription:
    "在一个提案里组合多个治理动作，按执行顺序发起链上变更。",
  previewTitle: "提交前预览",
  previewDescription:
    "这里会按顺序展示最终要写入 Governor.propose 的目标地址、编码动作与风险等级。",
  paramsTitle: "治理参数",
  paramsDescription:
    "展示当前治理所需的关键参数，便于在配置提案时随时参考。",
} as const;

export function moveGovernanceItem<T>(
  items: T[],
  fromIndex: number,
  toIndex: number
) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);

  if (item === undefined) {
    return items;
  }

  next.splice(toIndex, 0, item);
  return next;
}

export function getGovernanceCategoryOrder(category: GovernanceTemplateCategory) {
  switch (category) {
    case "content":
      return 0;
    case "treasury":
      return 1;
    case "governor":
      return 2;
    case "timelock":
      return 3;
    default:
      return 999;
  }
}

export function groupGovernanceTemplates(
  templates: GovernanceTemplateDefinition[]
) {
  return Object.entries(
    templates.reduce<Record<GovernanceTemplateCategory, GovernanceTemplateDefinition[]>>(
      (groups, template) => {
        groups[template.category].push(template);
        return groups;
      },
      {
        content: [],
        stake: [],
        treasury: [],
        governor: [],
        timelock: [],
      }
    )
  )
    .filter(([, items]) => items.length > 0)
    .sort(
      ([left], [right]) =>
        getGovernanceCategoryOrder(left as GovernanceTemplateCategory) -
        getGovernanceCategoryOrder(right as GovernanceTemplateCategory)
    ) as GovernanceGroupedTemplates;
}

export function getActiveGovernanceStep(input: {
  latestProposal?: ProposalItem;
  latestProposalStateValue?: bigint;
  latestProposalEtaValue?: bigint;
  liveBlockNumber?: bigint;
  nowTs: number;
}) {
  const {
    latestProposal,
    latestProposalEtaValue,
    latestProposalStateValue,
    liveBlockNumber,
    nowTs,
  } = input;

  if (!latestProposal) {
    return 1;
  }

  switch (Number(latestProposalStateValue ?? -1)) {
    case 0:
    case 1:
      return 2;
    case 4:
      return 3;
    case 5:
      return latestProposalEtaValue !== undefined &&
        latestProposalEtaValue > 0n &&
        BigInt(nowTs) >= latestProposalEtaValue
        ? 4
        : 3;
    case 7:
      return 4;
    case 2:
    case 3:
    case 6:
      return 2;
    default:
      return liveBlockNumber === undefined
        ? 2
        : latestProposal.voteEnd >= liveBlockNumber
          ? 2
          : 3;
  }
}

export function getCurrentGovernanceStageText(input: {
  draftActionCount: number;
  latestProposal?: ProposalItem;
  latestProposalStateValue?: bigint;
  latestProposalEtaValue?: bigint;
  nowTs: number;
  trimmedDescriptionLength: number;
}) {
  const {
    draftActionCount,
    latestProposal,
    latestProposalEtaValue,
    latestProposalStateValue,
    nowTs,
    trimmedDescriptionLength,
  } = input;

  if (!latestProposal) {
    return draftActionCount > 0 || trimmedDescriptionLength > 0
      ? "当前处于提案配置阶段"
      : "当前暂无提案，可先配置治理动作";
  }

  switch (Number(latestProposalStateValue ?? -1)) {
    case 0:
      return "当前提案已提交，等待投票开始";
    case 1:
      return "当前提案处于投票阶段";
    case 4:
      return "当前提案已通过，等待加入队列";
    case 5:
      return latestProposalEtaValue !== undefined &&
        latestProposalEtaValue > 0n &&
        BigInt(nowTs) >= latestProposalEtaValue
        ? "当前提案已到执行时间"
        : "当前提案已排队，等待执行时间";
    case 7:
      return "当前提案已执行完成";
    case 2:
      return "当前最新提案已取消";
    case 3:
      return "当前最新提案未通过";
    case 6:
      return "当前最新提案已过期";
    default:
      return "当前正在同步最新提案状态";
  }
}
