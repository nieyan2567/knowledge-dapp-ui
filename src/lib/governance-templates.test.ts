/**
 * @notice `governance-templates` 模块测试。
 * @dev 覆盖治理模板枚举、草稿创建、输入校验和动作编码逻辑。
 */
import { describe, expect, it } from "vitest";

import { CONTRACTS } from "@/contracts";
import {
  createGovernanceDraftAction,
  encodeGovernanceActionDraft,
  getGovernanceTemplateById,
  getGovernanceTemplates,
  validateGovernanceActionDraft,
} from "@/lib/governance-templates";

describe("governance-templates", () => {
  it("creates a default draft from a template", () => {
    const draft = createGovernanceDraftAction("content.setRewardRules");

    expect(draft.templateId).toBe("content.setRewardRules");
    expect(draft.values).toMatchObject({
      minVotesToReward: "10",
      rewardPerVote: "0.001",
    });
  });

  it("lists only supported proposal actions", () => {
    const templates = getGovernanceTemplates();

    expect(templates.length).toBe(17);
    expect(getGovernanceTemplateById("governor.setVotingPeriod")?.functionName).toBe(
      "setVotingPeriod"
    );
    expect(getGovernanceTemplateById("content.setContentFees")?.functionName).toBe(
      "setContentFees"
    );
    expect(getGovernanceTemplateById("governor.setProposalFee")?.functionName).toBe(
      "setProposalFee"
    );
    expect(getGovernanceTemplateById("stake.setCooldownSeconds")?.functionName).toBe(
      "setCooldownSeconds"
    );
    expect(getGovernanceTemplateById("stake.setActivationBlocks")?.functionName).toBe(
      "setActivationBlocks"
    );
    expect(getGovernanceTemplateById("revenueVault.setFaucetConfig")?.functionName).toBe(
      "setFaucetConfig"
    );
    expect(getGovernanceTemplateById("faucet.setSigner")?.functionName).toBe(
      "setSigner"
    );
    expect(getGovernanceTemplateById("faucet.setClaimConfig")?.functionName).toBe(
      "setClaimConfig"
    );
    expect(getGovernanceTemplateById("faucet.setBudgetConfig")?.functionName).toBe(
      "setBudgetConfig"
    );
    expect(getGovernanceTemplateById("content.setTreasury")).toBeNull();
    expect(getGovernanceTemplateById("content.setAntiSybil")).toBeNull();
    expect(getGovernanceTemplateById("content.pause")).toBeNull();
    expect(getGovernanceTemplateById("treasury.setSpender")).toBeNull();
    expect(getGovernanceTemplateById("governor.updateTimelock")).toBeNull();
    expect(getGovernanceTemplateById("timelock.grantRole")).toBeNull();
  });

  it("does not expose pause actions", () => {
    const templates = getGovernanceTemplates();

    expect(
      templates.every(
        (template) =>
          template.functionName !== "pause" && template.functionName !== "unpause"
      )
    ).toBe(true);
  });

  it("validates numeric template inputs before encoding", () => {
    const draft = createGovernanceDraftAction("timelock.updateDelay");
    draft.values.delaySeconds = "not-a-number";

    expect(validateGovernanceActionDraft(draft).ok).toBe(false);
  });

  it("encodes reward rules proposals", () => {
    const draft = createGovernanceDraftAction("content.setRewardRules");
    const encoded = encodeGovernanceActionDraft(draft);

    expect(encoded.templateId).toBe("content.setRewardRules");
    expect(encoded.target).toBe(CONTRACTS.KnowledgeContent);
    expect(encoded.value).toBe(0n);
    expect(encoded.calldata.startsWith("0x")).toBe(true);
    expect(encoded.description).toContain("单票奖励");
  });

  it("encodes content policy proposals", () => {
    const draft = createGovernanceDraftAction("content.setContentPolicy");
    draft.values.editLockVotes = "3";
    draft.values.allowDeleteAfterVote = true;
    draft.values.maxVersionsPerContent = "12";

    const encoded = encodeGovernanceActionDraft(draft);

    expect(encoded.templateId).toBe("content.setContentPolicy");
    expect(encoded.target).toBe(CONTRACTS.KnowledgeContent);
    expect(encoded.description).toContain("3");
    expect(encoded.description).toContain("12");
  });

  it("encodes content fee proposals", () => {
    const draft = createGovernanceDraftAction("content.setContentFees");
    draft.values.registerFee = "0.02";
    draft.values.updateFee = "0.01";

    const encoded = encodeGovernanceActionDraft(draft);

    expect(encoded.templateId).toBe("content.setContentFees");
    expect(encoded.target).toBe(CONTRACTS.KnowledgeContent);
    expect(encoded.description).toContain("0.02");
    expect(encoded.description).toContain("0.01");
  });

  it("allows zero fees for content and proposal fee actions", () => {
    const contentFeeDraft = createGovernanceDraftAction("content.setContentFees");
    contentFeeDraft.values.registerFee = "0";
    contentFeeDraft.values.updateFee = "0";

    const proposalFeeDraft = createGovernanceDraftAction("governor.setProposalFee");
    proposalFeeDraft.values.proposalFee = "0";

    expect(validateGovernanceActionDraft(contentFeeDraft).ok).toBe(true);
    expect(validateGovernanceActionDraft(proposalFeeDraft).ok).toBe(true);
  });

  it("encodes timelock delay proposals", () => {
    const draft = createGovernanceDraftAction("timelock.updateDelay");
    draft.values.delaySeconds = "7200";

    const encoded = encodeGovernanceActionDraft(draft);

    expect(encoded.templateId).toBe("timelock.updateDelay");
    expect(encoded.target).toBe(CONTRACTS.TimelockController);
    expect(encoded.description).toContain("7200");
  });

  it("encodes stake cooldown proposals", () => {
    const draft = createGovernanceDraftAction("stake.setCooldownSeconds");
    draft.values.cooldownSeconds = "5400";

    const encoded = encodeGovernanceActionDraft(draft);

    expect(encoded.templateId).toBe("stake.setCooldownSeconds");
    expect(encoded.target).toBe(CONTRACTS.NativeVotes);
    expect(encoded.description).toContain("5400");
  });

  it("encodes stake activation delay proposals", () => {
    const draft = createGovernanceDraftAction("stake.setActivationBlocks");
    draft.values.activationBlocks = "15";

    const encoded = encodeGovernanceActionDraft(draft);

    expect(encoded.templateId).toBe("stake.setActivationBlocks");
    expect(encoded.target).toBe(CONTRACTS.NativeVotes);
    expect(encoded.description).toContain("15");
  });

  it("encodes late quorum extension proposals", () => {
    const draft = createGovernanceDraftAction("governor.setLateQuorumVoteExtension");
    draft.values.lateQuorumVoteExtension = "25";

    const encoded = encodeGovernanceActionDraft(draft);

    expect(encoded.templateId).toBe("governor.setLateQuorumVoteExtension");
    expect(encoded.target).toBe(CONTRACTS.KnowledgeGovernor);
    expect(encoded.description).toContain("25");
  });

  it("encodes proposal fee proposals", () => {
    const draft = createGovernanceDraftAction("governor.setProposalFee");
    draft.values.proposalFee = "0.08";

    const encoded = encodeGovernanceActionDraft(draft);

    expect(encoded.templateId).toBe("governor.setProposalFee");
    expect(encoded.target).toBe(CONTRACTS.KnowledgeGovernor);
    expect(encoded.description).toContain("0.08");
  });

  it("encodes faucet governance proposals", () => {
    const signerDraft = createGovernanceDraftAction("faucet.setSigner");
    signerDraft.values.signer = "0x1111111111111111111111111111111111111111";

    const claimDraft = createGovernanceDraftAction("faucet.setClaimConfig");
    claimDraft.values.claimAmount = "2";
    claimDraft.values.minAllowedBalance = "1";
    claimDraft.values.claimCooldown = "86400";

    const budgetDraft = createGovernanceDraftAction("faucet.setBudgetConfig");
    budgetDraft.values.epochDuration = "86400";
    budgetDraft.values.epochBudget = "20";

    expect(encodeGovernanceActionDraft(signerDraft).templateId).toBe("faucet.setSigner");
    expect(encodeGovernanceActionDraft(claimDraft).templateId).toBe(
      "faucet.setClaimConfig"
    );
    expect(encodeGovernanceActionDraft(budgetDraft).templateId).toBe(
      "faucet.setBudgetConfig"
    );
  });
});
