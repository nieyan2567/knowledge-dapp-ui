import { parseEther } from "viem";

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
} as const;

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

export function formatStakeTokenInput(formatted: string) {
  if (!formatted.includes(".")) {
    return formatted;
  }

  return formatted.replace(/\.?0+$/, "") || "0";
}

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

export function formatStakeTimestamp(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    hour12: false,
  });
}

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
