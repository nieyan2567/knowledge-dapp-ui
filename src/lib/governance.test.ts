import { describe, expect, it } from "vitest";

import { createGovernanceDraftAction, encodeGovernanceActionDraft } from "@/lib/governance-templates";
import { summarizeProposalActions } from "@/lib/governance";

describe("governance summaries", () => {
  function summarizeFromTemplate(templateId: string, values?: Record<string, string | boolean>) {
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

  it("summarizes anti-sybil updates", () => {
    const summary = summarizeFromTemplate("content.setAntiSybil", {
      minStakeToVote: "2",
    });

    expect(summary?.title).toBe("更新 Anti-Sybil 配置");
    expect(summary?.description).toContain("最小质押门槛");
  });

  it("summarizes treasury spender updates", () => {
    const summary = summarizeFromTemplate("treasury.setSpender", {
      allowed: false,
    });

    expect(summary?.title).toBe("更新 Treasury Spender 权限");
    expect(summary?.description).toContain("撤销");
  });

  it("summarizes governor parameter updates", () => {
    const summary = summarizeFromTemplate("governor.setVotingPeriod", {
      votingPeriod: "42",
    });

    expect(summary?.title).toBe("更新投票周期");
    expect(summary?.description).toContain("42");
  });

  it("summarizes timelock delay updates", () => {
    const summary = summarizeFromTemplate("timelock.updateDelay", {
      delaySeconds: "900",
    });

    expect(summary?.title).toBe("更新 Timelock 延迟");
    expect(summary?.description).toContain("900");
  });
});
