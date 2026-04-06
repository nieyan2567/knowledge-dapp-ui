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
  viewGovernorContract: "查看 Governor 合约",
  currentStep: "当前步骤",
  currentStage: "当前阶段",
  proposalDescriptionLabel: "提案描述",
  proposalDescriptionPlaceholder: "描述这份治理提案的目标、影响范围与预期结果",
  draftActionsLabel: "提案动作",
  draftActionsCount: "当前 {current} / {max} 个动作",
  addAction: "新增动作",
  noActions: "当前还没有提案动作，请先添加至少一个治理动作。",
  highRiskConfirmation:
    "这份提案包含高风险治理动作，可能影响核心治理参数或执行延迟。我已核对目标合约、输入参数和预期影响。",
  proposalFeeLabel: "提案费用",
  proposalFeeLoading: "正在读取费用...",
  proposalFeeFree: "当前免费",
  proposalFeeHelp:
    "发起提案时会将这笔费用转入协议金库，用于抑制低成本垃圾提案。",
  submitProposal: "发起提案",
  previewDescriptionEmpty: "请输入提案描述，预览区会更完整地反映最终提交内容。",
  previewDescriptionLabel: "Proposal Description",
  metrics: {
    currentProposals: "当前提案",
    configuredActions: "已配置动作",
    highRiskActions: "高风险动作",
    actionCount: "动作数量",
    validActions: "有效动作",
  },
  params: {
    proposalThreshold: "提案门槛",
    proposalFee: "提案费用",
    votingDelay: "投票延迟",
    votingPeriod: "投票周期",
    governorAddress: "Governor 合约地址",
    openInExplorer: "在浏览器中查看",
    proposalThresholdHelp: "创建提案所需的最低投票权。",
    proposalFeeHelp: "提交提案时需要附带的协议费用，会直接转入 Revenue Vault。",
    votingDelayHelp: "提案创建后到投票开始前需要等待的区块数。",
    votingPeriodHelp: "提案保持可投票状态的持续区块数。",
  },
  errors: {
    encodeActionFailed: "提案动作编码失败",
    addActionLimit: `单个提案最多支持 ${MAX_GOVERNANCE_DRAFT_ACTIONS} 个动作`,
    connectWallet: "请先连接钱包",
    missingDescription: "请输入提案描述",
    missingActions: "请至少添加一个提案动作",
    confirmHighRisk: "请先确认高风险治理动作",
    feeLoading: "提案费用尚未加载完成",
    loadProposalList: "加载提案列表失败",
  },
  loading: {
    submitProposal: "正在提交提案...",
  },
  success: {
    submitProposal: "提案交易已提交",
  },
  fail: {
    submitProposal: "提案提交失败",
  },
  formatters: {
    stepLabel(step: number) {
      return `Step ${step}`;
    },
    actionCount(current: number, max: number) {
      return `当前 ${current} / ${max} 个动作`;
    },
  },
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
