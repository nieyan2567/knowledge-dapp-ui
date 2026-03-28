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

    expect(templates.length).toBe(11);
    expect(getGovernanceTemplateById("governor.setVotingPeriod")?.functionName).toBe(
      "setVotingPeriod"
    );
    expect(getGovernanceTemplateById("stake.setCooldownSeconds")?.functionName).toBe(
      "setCooldownSeconds"
    );
    expect(getGovernanceTemplateById("stake.setActivationBlocks")?.functionName).toBe(
      "setActivationBlocks"
    );
    expect(getGovernanceTemplateById("content.setTreasury")).toBeNull();
    expect(getGovernanceTemplateById("content.setAntiSybil")).toBeNull();
    expect(getGovernanceTemplateById("content.pause")).toBeNull();
    expect(getGovernanceTemplateById("treasury.setSpender")).toBeNull();
    expect(getGovernanceTemplateById("governor.updateTimelock")).toBeNull();
    expect(getGovernanceTemplateById("timelock.grantRole")).toBeNull();
  });

  it("does not expose address-based or pause actions", () => {
    const templates = getGovernanceTemplates();

    expect(
      templates.every((template) =>
        template.fields.every((field) => field.type !== "address" && field.type !== "select")
      )
    ).toBe(true);
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
});
