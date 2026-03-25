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

  it("summarizes anti-sybil updates", () => {
    const summary = summarizeFromTemplate("content.setAntiSybil", {
      minStakeToVote: "2",
    });

    expect(summary?.title).toBe("更新 Anti-Sybil 配置");
    expect(summary?.description).toContain("最小质押门槛");
    expect(summary?.details?.[0]?.label).toBe("Votes 合约");
  });

  it("summarizes treasury spender updates", () => {
    const summary = summarizeFromTemplate("treasury.setSpender", {
      allowed: false,
    });

    expect(summary?.title).toBe("更新 Treasury Spender 权限");
    expect(summary?.description).toContain("撤销");
    expect(summary?.details?.[1]?.value).toBe("撤销");
  });

  it("summarizes governor parameter updates", () => {
    const summary = summarizeFromTemplate("governor.setVotingPeriod", {
      votingPeriod: "42",
    });

    expect(summary?.title).toBe("更新投票周期");
    expect(summary?.description).toContain("42");
    expect(summary?.details?.[0]?.value).toContain("42");
  });

  it("summarizes timelock delay updates", () => {
    const summary = summarizeFromTemplate("timelock.updateDelay", {
      delaySeconds: "900",
    });

    expect(summary?.title).toBe("更新 Timelock 延迟");
    expect(summary?.description).toContain("900");
    expect(summary?.details?.[0]?.value).toBe("900 秒");
  });

  it("summarizes timelock role grants", () => {
    const summary = summarizeFromTemplate("timelock.grantRole", {
      account: "0x5f1F054903776a5025806Fc4FEeB0b0e55799A68",
    });

    expect(summary?.title).toBe("授予 Timelock 角色");
    expect(summary?.description).toContain("PROPOSER_ROLE");
    expect(summary?.details?.[0]?.value).toBe("PROPOSER_ROLE");
  });

  it("summarizes timelock role revocations", () => {
    const summary = summarizeFromTemplate("timelock.revokeRole", {
      account: "0x5f1F054903776a5025806Fc4FEeB0b0e55799A68",
    });

    expect(summary?.title).toBe("撤销 Timelock 角色");
    expect(summary?.description).toContain("PROPOSER_ROLE");
    expect(summary?.details?.[2]?.value).toBe("revokeRole");
  });
});
