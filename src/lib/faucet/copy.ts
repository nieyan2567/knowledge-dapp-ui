/**
 * @notice Faucet 页面与接口文案配置。
 * @dev 集中定义 Faucet 错误提示、页面文案与动态格式化函数。
 */
import { BRANDING } from "@/lib/branding";

/**
 * @notice Faucet 文案集合。
 * @dev 同时包含错误文案、页面区域文案与动态格式化函数。
 */
export const FAUCET_COPY = {
  errors: {
    invalidAddress: "无效的钱包地址",
    challengeExpired: "签名挑战不存在或已过期，请重新发起请求。",
    challengeMismatch: "签名挑战与当前请求不匹配。",
    challengeContextMismatch: "签名挑战与当前设备或网络环境不匹配。",
    invalidSignature: "钱包签名无效。",
    requestInFlight: "该钱包或当前网络已有 Faucet 请求正在处理中，请稍后重试。",
    serviceUnavailable: "Faucet 服务暂时不可用，请稍后再试。",
    claimFailed: "Faucet 发放失败，请稍后重试。",
    paused: "Faucet 当前已暂停，请稍后再试。",
    vaultBalanceLow: "FaucetVault 余额不足，请稍后再试。",
    budgetExhausted: "当前 Faucet 周期预算已用尽，请等待下一个预算周期。",
    topUpFunderMissing: "FAUCET_TOP_UP_FUNDER_PRIVATE_KEY is not configured",
    topUpFunderSameAddress:
      "Top-up funder address must be different from the faucet relayer",
    topUpFunderBalanceLow:
      "Top-up funder balance is below the configured faucet relayer top-up amount",
  },
  page: {
    connectWallet: "连接钱包",
    loadingWallet: "加载钱包中...",
    backToApp: "返回应用",
    heroEyebrow: `${BRANDING.chainName} Starter Faucet`,
    heroTitle: "Get starter funds and complete your first onchain action.",
    heroDescription: `这个 Faucet 会为新钱包发放少量 ${BRANDING.nativeTokenSymbol}，用于支付 Gas，并完成 ${BRANDING.appName} 中的首次上传、投票、领奖或质押操作。`,
    walletBalanceLabel: "Wallet balance",
    openExplorer: "Open explorer",
    signatureCardTitle: "仅需钱包签名",
    signatureCardDescription:
      "你只需要签署一条请求消息，后端会生成授权，并由 relayer 代为提交 FaucetVault 发放交易。",
    firstActionCardTitle: "用于首次操作",
    firstActionCardDescription:
      "这笔启动资金主要用于 Gas，以及你的首次投票、上传、奖励领取或质押流程。",
    cooldownCardTitle: "受冷却期保护",
    cooldownCardDescription:
      "重复领取会受到频率限制，余额已经足够的钱包也可能会被拒绝。",
    requestFundsLabel: "申请启动资金",
    connectedWalletLabel: "Connected wallet",
    disconnectedWalletHint: "连接钱包后可申请启动资金",
    chainLabel: "Chain",
    claimButtonIdle: `申请 ${BRANDING.nativeTokenSymbol}`,
    claimButtonLoading: "正在申请启动资金...",
    helperText: `这个 Faucet 面向需要初始 Gas 的新钱包。如果你的钱包已经持有足够的 ${BRANDING.nativeTokenSymbol}，申请可能会被拒绝。`,
    successTitlePrefix: "启动资金已发放",
    nextStepsTitle: "接下来可以做什么？",
    workflowTitle: "工作流程",
    rulesTitle: "规则说明",
    nextSteps: [
      "用这笔资金支付首次交易所需的 Gas。",
      "上传内容到 IPFS，并完成链上登记。",
      "领取已累计奖励，或激活你的第一笔质押。",
    ],
    workflow: [
      `连接 ${BRANDING.chainName} 网络上的钱包。`,
      "签署 Faucet 请求消息。",
      "后端验证签名后，代为提交 FaucetVault 发放交易。",
    ],
    rules: [
      "每个钱包和 IP 都会受到领取频率限制。",
      `仅接受 ${BRANDING.chainName} 网络上的钱包。`,
      "如果钱包余额已经足够，申请可能会被拒绝。",
    ],
    claimRequestChallengeFailed: "创建 Faucet 签名挑战失败",
    claimRequestFailed: "Faucet 请求失败",
    claimSuccess: "启动资金已发放",
    signatureCancelled: "已取消钱包签名",
    wrongNetwork: "网络错误",
  },
  formatters: {
    cooldown(seconds: number) {
      return `Faucet 冷却中，请在 ${seconds} 秒后重试。`;
    },
    minBalance(minAllowedBalance: string) {
      return `钱包余额已达到 Faucet 门槛（${minAllowedBalance}），暂时无需领取。`;
    },
    rateLimit(seconds: number) {
      return `请求过于频繁，请在 ${seconds} 秒后重试。`;
    },
    successTitle(claimAmount?: string | null) {
      return claimAmount
        ? `${FAUCET_COPY.page.successTitlePrefix}（${claimAmount}）`
        : FAUCET_COPY.page.successTitlePrefix;
    },
  },
} as const;

/**
 * @notice 生成 Faucet 冷却提示文案。
 * @param seconds 剩余冷却秒数。
 * @returns 带秒数占位替换的提示文本。
 */
export function getFaucetCooldownMessage(seconds: number) {
  return FAUCET_COPY.formatters.cooldown(seconds);
}

/**
 * @notice 生成 Faucet 最低余额提示文案。
 * @param minAllowedBalance 最低余额阈值文本。
 * @returns 带阈值占位替换的提示文本。
 */
export function getFaucetMinBalanceMessage(minAllowedBalance: string) {
  return FAUCET_COPY.formatters.minBalance(minAllowedBalance);
}

/**
 * @notice 生成 Faucet 限流提示文案。
 * @param seconds 剩余等待秒数。
 * @returns 带秒数占位替换的限流提示文本。
 */
export function getFaucetRateLimitMessage(seconds: number) {
  return FAUCET_COPY.formatters.rateLimit(seconds);
}

/**
 * @notice 生成 Faucet 成功标题文案。
 * @param claimAmount 可选的领取金额文本。
 * @returns 带金额信息的成功标题。
 */
export function getFaucetSuccessTitle(claimAmount?: string | null) {
  return FAUCET_COPY.formatters.successTitle(claimAmount);
}
