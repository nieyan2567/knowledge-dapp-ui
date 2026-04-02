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

export const CONTRACTS = deployment.contracts as DeploymentContracts & {
    FaucetVault?: `0x${string}`;
};

export const ABIS = {
    NativeVotes: NativeVotesArtifact.abi as Abi,
    KnowledgeContent: KnowledgeContentArtifact.abi as Abi,
    TreasuryNative: TreasuryNativeArtifact.abi as Abi,
    FaucetVault: FaucetVaultArtifact.abi as Abi,
    RevenueVault: RevenueVaultArtifact.abi as Abi,
    KnowledgeGovernor: KnowledgeGovernorArtifact.abi as Abi,
    TimelockController: TimelockControllerArtifact.abi as Abi,
};
