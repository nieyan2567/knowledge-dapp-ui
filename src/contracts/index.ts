import deployment from "./deployment.json";
import NativeVotesArtifact from "./abi/NativeVotes.json";
import KnowledgeContentArtifact from "./abi/KnowledgeContent.json";
import TreasuryNativeArtifact from "./abi/TreasuryNative.json";
import KnowledgeGovernorArtifact from "./abi/KnowledgeGovernor.json";
import TimelockControllerArtifact from "./abi/TimelockController.json";

export const CONTRACTS = deployment.contracts;

export const ABIS = {
  NativeVotes: NativeVotesArtifact.abi,
  KnowledgeContent: KnowledgeContentArtifact.abi,
  TreasuryNative: TreasuryNativeArtifact.abi,
  KnowledgeGovernor: KnowledgeGovernorArtifact.abi,
  TimelockController: TimelockControllerArtifact.abi,
};