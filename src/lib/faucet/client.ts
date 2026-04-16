/**
 * @file Faucet 链上客户端模块。
 * @description 负责 Faucet 合约读取、授权签名生成、代付领取和维护任务执行。
 */
import { randomBytes } from "node:crypto";

import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  http,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { ABIS, CONTRACTS } from "@/contracts";
import { getKnowledgeChain } from "@/lib/chains";
import {
  getAuthorizationDeadlineSeconds,
  getFaucetAuthSignerPrivateKey,
  getFaucetRelayerAlertMinBalance,
  getFaucetRelayerPrivateKey,
  getFaucetRelayerTopUpAmount,
  getFaucetTopUpFunderPrivateKey,
  getFaucetVaultAddress,
  getFaucetVaultAlertMinBalance,
  getRpcUrl,
} from "@/lib/faucet/config";
import { FaucetInfraError } from "@/lib/faucet/types";
import type {
  FaucetClaimAuthorization,
  FaucetMaintenanceReport,
} from "@/lib/faucet/types";
import { captureServerEvent } from "@/lib/observability/server";

/**
 * @notice Faucet 链上客户端集合。
 * @dev 统一缓存 RPC 读客户端、Relayer 写客户端和签名账户。
 */
type FaucetClients = {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  relayerAccount: ReturnType<typeof privateKeyToAccount>;
  authSignerAccount: ReturnType<typeof privateKeyToAccount>;
};

let faucetClients: FaucetClients | undefined;

/**
 * @notice 获取 Faucet 所需的链上客户端和账户对象。
 * @returns Faucet 客户端集合。
 */
export async function getFaucetClients(): Promise<FaucetClients> {
  if (faucetClients) {
    return faucetClients;
  }

  const knowledgeChain = getKnowledgeChain();
  const relayerAccount = privateKeyToAccount(getFaucetRelayerPrivateKey());
  const authSignerAccount = privateKeyToAccount(getFaucetAuthSignerPrivateKey());
  const transport = http(getRpcUrl());

  const clients: FaucetClients = {
    relayerAccount,
    authSignerAccount,
    publicClient: createPublicClient({
      chain: knowledgeChain,
      transport,
    }) as ReturnType<typeof createPublicClient>,
    walletClient: createWalletClient({
      account: relayerAccount,
      chain: knowledgeChain,
      transport,
    }) as ReturnType<typeof createWalletClient>,
  };

  faucetClients = clients;
  return clients;
}

/**
 * @notice 读取 FaucetVault 当前配置和运行状态。
 * @returns 包含领取额度、冷却、预算和暂停状态的配置对象。
 * @throws 当 FaucetVault 合约不存在时抛出基础设施异常。
 */
export async function readFaucetVaultConfig() {
  const { publicClient } = await getFaucetClients();
  const faucetVaultAddress = getFaucetVaultAddress();
  const code = await publicClient.getCode({ address: faucetVaultAddress });

  if (!code || code === "0x") {
    throw new FaucetInfraError("FaucetVault 合约不存在或部署信息已过期。");
  }

  const [
    claimAmount,
    minAllowedBalance,
    claimCooldown,
    availableBudget,
    paused,
  ] = await Promise.all([
    publicClient.readContract({
      address: faucetVaultAddress,
      abi: ABIS.FaucetVault,
      functionName: "claimAmount",
    }),
    publicClient.readContract({
      address: faucetVaultAddress,
      abi: ABIS.FaucetVault,
      functionName: "minAllowedBalance",
    }),
    publicClient.readContract({
      address: faucetVaultAddress,
      abi: ABIS.FaucetVault,
      functionName: "claimCooldown",
    }),
    publicClient.readContract({
      address: faucetVaultAddress,
      abi: ABIS.FaucetVault,
      functionName: "availableBudget",
    }),
    publicClient.readContract({
      address: faucetVaultAddress,
      abi: ABIS.FaucetVault,
      functionName: "paused",
    }),
  ]);

  return {
    address: faucetVaultAddress,
    claimAmount: claimAmount as bigint,
    minAllowedBalance: minAllowedBalance as bigint,
    claimCooldown: claimCooldown as bigint,
    availableBudget: availableBudget as bigint,
    paused: paused as boolean,
  };
}

/**
 * @notice 查询指定地址上次成功领取 Faucet 的时间戳。
 * @param address 领取地址。
 * @returns 最近一次领取时间的链上时间戳。
 */
export async function readRecipientLastClaimAt(address: `0x${string}`) {
  const { publicClient } = await getFaucetClients();
  const faucetVaultAddress = getFaucetVaultAddress();

  return publicClient.readContract({
    address: faucetVaultAddress,
    abi: ABIS.FaucetVault,
    functionName: "lastClaimAt",
    args: [address],
  }) as Promise<bigint>;
}

function encodeClaimRequestHash(input: {
  recipient: `0x${string}`;
  amount: bigint;
  deadline: bigint;
  nonce: `0x${string}`;
}) {
  const knowledgeChain = getKnowledgeChain();
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "bytes32" },
      ],
      [
        BigInt(knowledgeChain.id),
        getFaucetVaultAddress(),
        input.recipient,
        input.amount,
        input.deadline,
        input.nonce,
      ]
    )
  );
}

/**
 * @notice 为指定领取地址生成一次性 Faucet 领取授权。
 * @param recipient 目标领取地址。
 * @returns 包含金额、截止时间、随机数和签名的授权对象。
 */
export async function createFaucetClaimAuthorization(
  recipient: `0x${string}`
): Promise<FaucetClaimAuthorization> {
  const { authSignerAccount } = await getFaucetClients();
  const { claimAmount } = await readFaucetVaultConfig();
  const deadline = BigInt(
    Math.floor(Date.now() / 1000) + getAuthorizationDeadlineSeconds()
  );
  const nonce = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
  const requestHash = encodeClaimRequestHash({
    recipient,
    amount: claimAmount,
    deadline,
    nonce,
  });

  const signature = await authSignerAccount.signMessage({
    message: { raw: requestHash },
  });

  return {
    amount: claimAmount,
    deadline,
    nonce,
    signature,
  };
}

/**
 * @notice 由 Relayer 代付执行 Faucet 领取交易。
 * @param input 领取所需的全部授权参数。
 * @returns 成功提交并确认后的交易哈希。
 */
export async function submitFaucetClaim(input: {
  recipient: `0x${string}`;
  amount: bigint;
  deadline: bigint;
  nonce: `0x${string}`;
  signature: `0x${string}`;
}) {
  const { publicClient, walletClient, relayerAccount } = await getFaucetClients();
  const faucetVaultAddress = getFaucetVaultAddress();

  const txHash = await walletClient.sendTransaction({
    account: relayerAccount,
    to: faucetVaultAddress,
    data: encodeFunctionData({
      abi: ABIS.FaucetVault,
      functionName: "claim",
      args: [
        input.recipient,
        input.amount,
        input.deadline,
        input.nonce,
        input.signature,
      ],
    }),
    chain: getKnowledgeChain(),
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

/**
 * @notice 调用 RevenueVault 的再平衡逻辑，为 Faucet 补充资金。
 * @returns 交易哈希；若未配置或未部署 RevenueVault 则返回 `null`。
 */
export async function rebalanceRevenueVault() {
  const { relayerAccount, publicClient, walletClient } = await getFaucetClients();
  const revenueVaultAddress = CONTRACTS.RevenueVault as `0x${string}` | undefined;

  if (!revenueVaultAddress) {
    return null;
  }

  const code = await publicClient.getCode({ address: revenueVaultAddress });
  if (!code || code === "0x") {
    return null;
  }

  const txHash = await walletClient.sendTransaction({
    account: relayerAccount,
    to: revenueVaultAddress,
    data: encodeFunctionData({
      abi: ABIS.RevenueVault,
      functionName: "rebalance",
      args: [],
    }),
    chain: getKnowledgeChain(),
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

async function alertFaucetMaintenanceIssue(input: {
  source: string;
  severity: "warn" | "error";
  message: string;
  fingerprint: string;
  context?: Record<string, unknown>;
}) {
  await captureServerEvent({
    message: input.message,
    source: input.source,
    severity: input.severity,
    fingerprint: input.fingerprint,
    context: input.context,
  });
}

async function topUpFaucetRelayerBalance(
  relayerAddress: `0x${string}`,
  amount: bigint
): Promise<FaucetMaintenanceReport["topUp"]> {
  const funderKey = getFaucetTopUpFunderPrivateKey();

  if (!funderKey) {
    return {
      attempted: false,
      error: "FAUCET_TOP_UP_FUNDER_PRIVATE_KEY is not configured",
    };
  }

  const funderAccount = privateKeyToAccount(funderKey);
  const { publicClient } = await getFaucetClients();

  // Top-up 资金账户不能和 Relayer 复用，否则无法表达独立补充来源，也会放大误配置风险。
  if (funderAccount.address.toLowerCase() === relayerAddress.toLowerCase()) {
    return {
      attempted: false,
      funderAddress: funderAccount.address,
      error: "Top-up funder address must be different from the faucet relayer",
    };
  }

  const funderBalance = await publicClient.getBalance({
    address: funderAccount.address,
  });

  if (funderBalance < amount) {
    return {
      attempted: true,
      funderAddress: funderAccount.address,
      amount: amount.toString(),
      error: "Top-up funder balance is below the configured faucet relayer top-up amount",
    };
  }

  const funderWalletClient = createWalletClient({
    account: funderAccount,
    chain: getKnowledgeChain(),
    transport: http(getRpcUrl()),
  });

  const txHash = await funderWalletClient.sendTransaction({
    account: funderAccount,
    chain: getKnowledgeChain(),
    to: relayerAddress,
    value: amount,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    attempted: true,
    txHash,
    amount: amount.toString(),
    funderAddress: funderAccount.address,
  };
}

/**
 * @notice 运行 Faucet 维护巡检。
 * @returns 维护报告，包含 relayer 余额、FaucetVault 状态、自动补充结果和告警问题列表。
 */
export async function runFaucetMaintenance(): Promise<FaucetMaintenanceReport> {
  const { publicClient, relayerAccount } = await getFaucetClients();
  const relayerAlertMinBalance = getFaucetRelayerAlertMinBalance();
  const relayerTopUpAmount = getFaucetRelayerTopUpAmount();
  let relayerBalance = await publicClient.getBalance({
    address: relayerAccount.address,
  });
  const issues: string[] = [];
  let topUp: FaucetMaintenanceReport["topUp"] = { attempted: false };

  // 先检查 Relayer 余额，不足时记录告警并尝试按配置自动补充。
  if (relayerBalance < relayerAlertMinBalance) {
    const lowBalanceMessage = `Faucet relayer balance dropped below threshold: ${formatEther(
      relayerBalance
    )} < ${formatEther(relayerAlertMinBalance)} ${getKnowledgeChain().nativeCurrency.symbol}`;

    issues.push(lowBalanceMessage);
    await alertFaucetMaintenanceIssue({
      source: "faucet.maintenance.relayer.low_balance",
      severity: "warn",
      message: lowBalanceMessage,
      fingerprint: `faucet:relayer-low-balance:${relayerAccount.address.toLowerCase()}`,
      context: {
        relayerAddress: relayerAccount.address,
        relayerBalance: relayerBalance.toString(),
        alertMinBalance: relayerAlertMinBalance.toString(),
      },
    });

    topUp = await topUpFaucetRelayerBalance(relayerAccount.address, relayerTopUpAmount);

    if (topUp.error) {
      issues.push(topUp.error);
      await alertFaucetMaintenanceIssue({
        source: "faucet.maintenance.relayer.top_up_failed",
        severity: "error",
        message: `Faucet relayer top-up failed: ${topUp.error}`,
        fingerprint: `faucet:relayer-topup-failed:${relayerAccount.address.toLowerCase()}`,
        context: {
          relayerAddress: relayerAccount.address,
          topUpAmount: relayerTopUpAmount.toString(),
          funderAddress: topUp.funderAddress,
        },
      });
    } else if (topUp.txHash) {
      relayerBalance = await publicClient.getBalance({
        address: relayerAccount.address,
      });
      await captureServerEvent({
        message: "Faucet relayer wallet topped up successfully",
        source: "faucet.maintenance.relayer.top_up_succeeded",
        severity: "warn",
        alert: false,
        context: {
          relayerAddress: relayerAccount.address,
          funderAddress: topUp.funderAddress,
          amount: topUp.amount,
          txHash: topUp.txHash,
          relayerBalance: relayerBalance.toString(),
        },
      });
    }
  }

  const faucetVaultConfig = await readFaucetVaultConfig();
  const faucetVaultBalance = await publicClient.getBalance({
    address: faucetVaultConfig.address,
  });
  const faucetVaultAlertMinBalance = getFaucetVaultAlertMinBalance();

  // 再检查 FaucetVault 自身余额，避免前端继续放行领取但链上资金已经接近耗尽。
  if (
    faucetVaultAlertMinBalance !== undefined &&
    faucetVaultBalance < faucetVaultAlertMinBalance
  ) {
    const lowVaultMessage = `FaucetVault balance dropped below threshold: ${formatEther(
      faucetVaultBalance
    )} < ${formatEther(faucetVaultAlertMinBalance)} ${getKnowledgeChain().nativeCurrency.symbol}`;

    issues.push(lowVaultMessage);
    await alertFaucetMaintenanceIssue({
      source: "faucet.maintenance.vault.low_balance",
      severity: "warn",
      message: lowVaultMessage,
      fingerprint: `faucet:vault-low-balance:${faucetVaultConfig.address.toLowerCase()}`,
      context: {
        faucetVaultAddress: faucetVaultConfig.address,
        faucetVaultBalance: faucetVaultBalance.toString(),
        alertMinBalance: faucetVaultAlertMinBalance.toString(),
        claimAmount: faucetVaultConfig.claimAmount.toString(),
        availableBudget: faucetVaultConfig.availableBudget.toString(),
      },
    });
  }

  return {
    status: issues.length > 0 ? "degraded" : "ok",
    relayer: {
      address: relayerAccount.address,
      balance: relayerBalance.toString(),
      alertMinBalance: relayerAlertMinBalance.toString(),
    },
    topUp,
    faucetVault: {
      address: faucetVaultConfig.address,
      balance: faucetVaultBalance.toString(),
      claimAmount: faucetVaultConfig.claimAmount.toString(),
      availableBudget: faucetVaultConfig.availableBudget.toString(),
      paused: faucetVaultConfig.paused,
      alertMinBalance: faucetVaultAlertMinBalance?.toString(),
    },
    issues,
  };
}
