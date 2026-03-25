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

  it("lists supported governance templates", () => {
    const templates = getGovernanceTemplates();

    expect(templates.length).toBeGreaterThanOrEqual(10);
    expect(getGovernanceTemplateById("governor.setVotingPeriod")?.functionName).toBe(
      "setVotingPeriod"
    );
  });

  it("validates template inputs before encoding", () => {
    const draft = createGovernanceDraftAction("content.setTreasury");
    draft.values.treasury = "not-an-address";

    expect(validateGovernanceActionDraft(draft)).toEqual({
      ok: false,
      error: "Treasury 地址不是有效地址",
    });
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

  it("encodes treasury spender proposals with boolean values", () => {
    const draft = createGovernanceDraftAction("treasury.setSpender");
    draft.values.spender = CONTRACTS.KnowledgeGovernor;
    draft.values.allowed = false;

    const encoded = encodeGovernanceActionDraft(draft);

    expect(encoded.templateId).toBe("treasury.setSpender");
    expect(encoded.target).toBe(CONTRACTS.TreasuryNative);
    expect(encoded.description).toContain("撤销");
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
