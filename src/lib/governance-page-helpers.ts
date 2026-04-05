import type {
  GovernanceTemplateCategory,
  GovernanceTemplateDefinition,
} from "@/types/governance";

export const MAX_GOVERNANCE_DRAFT_ACTIONS = 5;

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
    ) as Array<[GovernanceTemplateCategory, GovernanceTemplateDefinition[]]>;
}
