/**
 * @notice Stake 页面展示与格式化工具。
 * @dev 定义质押流程说明文案，并提供金额、时间和数量格式化辅助函数。
 */
import { parseEther } from "viem";

/**
 * @notice Stake 流程步骤定义。
 * @dev 用于页面流程卡片展示 Deposit、Activate、Withdraw 等阶段。
 */
export const STAKE_FLOW_STEPS = [
  {
    id: 1,
    title: "Deposit",
    description: "先存入原生币，形成待激活质押。",
  },
  {
    id: 2,
    title: "Activate",
    description: "等待激活区块达到后启用投票权。",
  },
  {
    id: 3,
    title: "Request Withdraw",
    description: "申请退出后，质押会进入冷却阶段。",
  },
  {
    id: 4,
    title: "Withdraw",
    description: "冷却结束后提取原生币回到钱包。",
  },
] as const;

/**
 * @notice Stake 页面静态文案集合。
 * @dev 集中管理按钮文本、提示文案、状态说明和各区域标题。
 */
export const STAKE_COPY = {
  headerTitle: "Stake & Voting Power",
  headerDescription:
    "先质押原生币并激活投票权，再参与内容投票和 DAO 治理；退出质押需要先申请，再等待冷却期结束。",
  depositSectionTitle: "质押、激活与撤回待激活",
  depositSectionDescription:
    "先发起 Deposit 锁定原生币；等激活区块数达到后执行 Activate 获得投票权。若尚未激活，也可以直接撤回。",
  withdrawSectionTitle: "退出与提现",
  withdrawSectionDescription:
    "先申请退出，系统会立即减少投票权；等冷却期结束后，再执行 Withdraw 提取原生币。",
  connectWalletFirst: "请先连接钱包",
  invalidAmountPrefix: "请输入有效的",
  amountRequiredPrefix: "请输入",
  amountMustBePositiveSuffix: "必须大于 0",
  depositFieldLabel: "质押数量",
  cancelPendingFieldLabel: "撤回数量",
  requestWithdrawFieldLabel: "退出数量",
  withdrawFieldLabel: "提取数量",
  walletBalanceExceeded: "质押数量不能超过钱包可用余额",
  noPendingStake: "当前没有待激活的质押",
  activateWaitPrefix: "还需等待",
  activateWaitSuffix: "个区块后才能激活",
  activateLoading: "正在提交激活交易...",
  activateSuccess: "激活交易已提交",
  activateFail: "激活失败",
  depositLoading: "正在提交质押交易...",
  depositSuccess: "质押交易已提交",
  depositFail: "质押失败",
  noPendingStakeToCancel: "当前没有可撤回的待激活质押",
  cancelPendingExceeded: "撤回数量不能超过待激活质押",
  cancelPendingLoading: "正在提交待激活质押撤回交易...",
  cancelPendingSuccess: "待激活质押撤回交易已提交",
  cancelPendingFail: "撤回待激活质押失败",
  pendingWithdrawExists: "当前已有待提取余额，请等待冷却结束后再提取",
  noStakedBalance: "当前没有可退出的已质押余额",
  withdrawRequestExceeded: "退出数量不能超过已质押余额",
  requestWithdrawLoading: "正在提交退出申请...",
  requestWithdrawSuccess: "退出申请已提交",
  requestWithdrawFail: "退出申请失败",
  noPendingWithdraw: "当前没有可提取的待提取余额",
  withdrawExceeded: "提取数量不能超过待提取余额",
  withdrawWaitPrefix: "还需等待",
  withdrawWaitSuffix: "后才能提取",
  withdrawLoading: "正在提交提取交易...",
  withdrawSuccess: "提取交易已提交",
  withdrawFail: "提取失败",
  flowTitle: "Stake 操作路径",
  currentStepLabel: "当前步骤",
  currentStageBadge: "当前阶段",
  votesLabel: "投票权",
  votesDescription: "已激活并生效的治理投票权。",
  activeStakeLabel: "已激活质押",
  activeStakeDescription: "当前已生效的质押余额。",
  pendingStakeLabel: "待激活质押",
  pendingWithdrawLabel: "待提取金额",
  canActivateNow: "现在可以激活",
  defaultActivationWaitPrefix: "默认等待",
  defaultActivationWaitSuffix: "个区块",
  pendingWithdrawReady: "现在可以提取",
  defaultCooldownPrefix: "默认冷却",
  walletQuickFillLabel: "按钱包余额填充",
  stakedQuickFillLabel: "按已质押余额填充",
  pendingWithdrawQuickFillLabel: "按待提取余额填充",
  fillAllStaked: "全部已质押",
  fillAllPendingWithdraw: "全部待提取",
  depositInputPlaceholder: "输入质押或撤回待激活数量，例如 1",
  withdrawInputPlaceholder: "输入退出或提取数量，例如 1",
  walletBalanceSummary: "钱包可用余额",
  pendingStakeSummary: "当前待激活质押",
  defaultActivationSummary: "默认激活等待",
  cooldownSummary: "退出冷却期",
  depositButton: "存入",
  activateButton: "激活",
  cancelPendingButton: "撤回待激活",
  requestWithdrawButton: "申请退出",
  withdrawButton: "提取",
  stageDisconnected: "当前未连接钱包",
  stagePendingWithdrawWaitingPrefix: "当前处于退出冷却阶段，还需等待",
  stagePendingWithdrawReady: "当前已满足提现条件，可执行 Withdraw",
  stagePendingStakeWaitingPrefix: "当前存在待激活质押，还需",
  stagePendingStakeWaitingSuffix: "个区块后可 Activate",
  stagePendingStakeReady: "当前待激活质押已就绪，可执行 Activate 或直接撤回",
  stageHasVotes: "当前已持有生效投票权，可申请退出",
  stageIdle: "当前尚未开始质押，可先执行 Deposit",
  activateHelperDisconnected: "连接钱包后可查看激活条件。",
  activateHelperEmpty: "暂无待激活质押，先存入后再激活。",
  activateHelperWaiting:
    "还需等待 {blocks} 个区块，预计在区块 #{targetBlock} 后可激活；如需退出，也可直接撤回待激活质押。",
  activateHelperReady: "当前待激活质押已满足条件，可以立即激活，也可以直接撤回。",
  withdrawHelperDisconnected: "连接钱包后可查看提现冷却状态。",
  withdrawHelperEmpty: "暂无待提取余额，申请退出后会进入冷却期。",
  withdrawHelperWaiting: "还需等待 {duration}，预计 {time} 后可提取。",
  withdrawHelperReady: "当前待提取余额已满足条件，可以立即提取。",
} as const;

/**
 * @notice 将用户输入解析为质押金额。
 * @param value 用户输入的字符串金额。
 * @returns 合法且大于 0 的金额值；否则返回 `null`。
 */
export function tryParseStakeAmount(value: string) {
  if (!value.trim()) {
    return null;
  }

  try {
    const amount = parseEther(value.trim());
    return amount > 0n ? amount : null;
  } catch {
    return null;
  }
}

/**
 * @notice 格式化质押金额输入框展示值。
 * @param formatted 已格式化的金额字符串。
 * @returns 去除尾随零后的展示文本。
 */
export function formatStakeTokenInput(formatted: string) {
  if (!formatted.includes(".")) {
    return formatted;
  }

  return formatted.replace(/\.?0+$/, "") || "0";
}

/**
 * @notice 将秒数格式化为质押页面使用的时长文案。
 * @param seconds 需要格式化的秒数。
 * @returns 中文时长描述；若已到期则返回立即可操作提示。
 */
export function formatStakeDuration(seconds: bigint) {
  if (seconds <= 0n) return "现在即可操作";

  const total = Number(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainSeconds = total % 60;

  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  if (minutes > 0) return `${minutes}分钟 ${remainSeconds}秒`;
  return `${remainSeconds}秒`;
}

/**
 * @notice 将秒级时间戳格式化为本地时间文本。
 * @param timestamp 秒级 Unix 时间戳。
 * @returns 本地化后的日期时间字符串。
 */
export function formatStakeTimestamp(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    hour12: false,
  });
}

/**
 * @notice 按比例缩放质押数量。
 * @param base 基础数量。
 * @param numerator 缩放分子。
 * @param denominator 缩放分母。
 * @returns 缩放后的非负数量。
 */
export function getScaledStakeAmount(
  base: bigint,
  numerator: bigint,
  denominator: bigint
) {
  if (base <= 0n) return 0n;
  if (numerator === denominator) return base;

  const scaled = (base * numerator) / denominator;
  return scaled > 0n ? scaled : 0n;
}
