import { describe, expect, it } from "vitest";

import {
  createGovernanceDraftAction,
  encodeGovernanceActionDraft,
} from "@/lib/governance-templates";
import { summarizeProposalActions } from "@/lib/governance";

describe("governance summaries", () => {
  function summarizeFromTemplate(
    templateId: string,
    values?: Record<string, string | boolean>
  ) {
    const draft = createGovernanceDraftAction(templateId);
    if (values) {
      draft.values = {
        ...draft.values,
        ...values,
      };
    }

    const encoded = encodeGovernanceActionDraft(draft);

    return summarizeProposalActions({
      targets: [encoded.target],
      values: [encoded.value],
      calldatas: [encoded.calldata],
    })[0];
  }

  it("summarizes reward rule updates", () => {
    const summary = summarizeFromTemplate("content.setRewardRules", {
      minVotesToReward: "12",
      rewardPerVote: "0.002",
    });

    expect(summary?.title).toContain("奖励");
    expect(summary?.description).toContain("12");
    expect(summary?.details?.[0]?.value).toBe("12");
  });

  it("summarizes treasury budget updates", () => {
    const summary = summarizeFromTemplate("treasury.setBudget", {
      epochDuration: "3600",
      epochBudget: "250",
    });

    expect(summary?.title).toContain("Treasury");
    expect(summary?.description).toContain("3600");
    expect(summary?.details?.[0]?.value).toContain("3600");
  });

  it("summarizes governor parameter updates", () => {
    const summary = summarizeFromTemplate("governor.setVotingPeriod", {
      votingPeriod: "42",
    });

    expect(summary?.title).toContain("投票");
    expect(summary?.description).toContain("42");
    expect(summary?.details?.[0]?.value).toContain("42");
  });

  it("summarizes timelock delay updates", () => {
    const summary = summarizeFromTemplate("timelock.updateDelay", {
      delaySeconds: "900",
    });

    expect(summary?.title).toContain("Timelock");
    expect(summary?.description).toContain("900");
    expect(summary?.details?.[0]?.value).toContain("900");
  });
});
