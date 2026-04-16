/**
 * @file 合约部署索引模块。
 * @description 暴露当前部署环境下的合约地址映射和 ABI 集合。
 */
import type { Abi } from "viem";

import deployment from "./deployment.json";
import NativeVotesArtifact from "./abi/NativeVotes.json";
import KnowledgeContentArtifact from "./abi/KnowledgeContent.json";
import TreasuryNativeArtifact from "./abi/TreasuryNative.json";
import FaucetVaultArtifact from "./abi/FaucetVault.json";
import RevenueVaultArtifact from "./abi/RevenueVault.json";
import KnowledgeGovernorArtifact from "./abi/KnowledgeGovernor.json";
import TimelockControllerArtifact from "./abi/TimelockController.json";

type DeploymentContracts = (typeof deployment)["contracts"];

/**
 * @notice 当前部署环境的合约地址映射。
 * @dev 基于 `deployment.json` 生成，并保留 `FaucetVault` 的可选兼容类型。
 */
export const CONTRACTS = deployment.contracts as DeploymentContracts & {
    FaucetVault?: `0x${string}`;
};

/**
 * @notice 前端使用的合约 ABI 集合。
 * @dev 键名与 `CONTRACTS` 中的主要合约保持一致，方便统一读写合约调用。
 */
export const ABIS = {
    NativeVotes: NativeVotesArtifact.abi as Abi,
    KnowledgeContent: KnowledgeContentArtifact.abi as Abi,
    TreasuryNative: TreasuryNativeArtifact.abi as Abi,
    FaucetVault: FaucetVaultArtifact.abi as Abi,
    RevenueVault: RevenueVaultArtifact.abi as Abi,
    KnowledgeGovernor: KnowledgeGovernorArtifact.abi as Abi,
    TimelockController: TimelockControllerArtifact.abi as Abi,
};
