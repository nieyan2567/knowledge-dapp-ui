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

  it("lists only templates without address inputs", () => {
    const templates = getGovernanceTemplates();

    expect(templates.length).toBeGreaterThanOrEqual(6);
    expect(getGovernanceTemplateById("governor.setVotingPeriod")?.functionName).toBe(
      "setVotingPeriod"
    );
    expect(getGovernanceTemplateById("content.setTreasury")).toBeNull();
    expect(getGovernanceTemplateById("timelock.grantRole")).toBeNull();
    expect(
      templates.every((template) =>
        template.fields.every((field) => field.type !== "address")
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
    expect(encoded.description.length).toBeGreaterThan(0);
  });

  it("encodes timelock delay proposals", () => {
    const draft = createGovernanceDraftAction("timelock.updateDelay");
    draft.values.delaySeconds = "7200";

    const encoded = encodeGovernanceActionDraft(draft);

    expect(encoded.templateId).toBe("timelock.updateDelay");
    expect(encoded.target).toBe(CONTRACTS.TimelockController);
    expect(encoded.description).toContain("7200");
  });
});
