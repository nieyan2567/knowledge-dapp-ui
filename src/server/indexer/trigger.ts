import { syncContentIndexOnce } from "./handlers/content";
import { syncProposalIndexOnce } from "./handlers/proposal";
import { syncRewardIndexOnce } from "./handlers/reward";
import { syncStakeIndexOnce } from "./handlers/stake";
import { syncSystemIndexOnce } from "./handlers/system";

export type IndexerTriggerDomain =
  | "stake"
  | "rewards"
  | "content"
  | "governance"
  | "dashboard"
  | "system";

type IndexerTriggerResult = {
  triggered_domains: IndexerTriggerDomain[];
  sync_results: Partial<
    Record<
      "content" | "proposal" | "reward" | "stake" | "system",
      Awaited<ReturnType<typeof syncContentIndexOnce>>
      | Awaited<ReturnType<typeof syncProposalIndexOnce>>
      | Awaited<ReturnType<typeof syncRewardIndexOnce>>
      | Awaited<ReturnType<typeof syncStakeIndexOnce>>
      | Awaited<ReturnType<typeof syncSystemIndexOnce>>
    >
  >;
};

let inFlightSync: Promise<IndexerTriggerResult> | null = null;

function mapDomainsToSyncTargets(domains: IndexerTriggerDomain[]) {
  const targets = new Set<"content" | "proposal" | "reward" | "stake" | "system">();

  for (const domain of domains) {
    switch (domain) {
      case "content":
        targets.add("content");
        break;
      case "governance":
        targets.add("proposal");
        break;
      case "rewards":
        targets.add("reward");
        targets.add("system");
        break;
      case "stake":
        targets.add("stake");
        targets.add("system");
        break;
      case "system":
        targets.add("system");
        break;
      case "dashboard":
        break;
      default:
        break;
    }
  }

  return Array.from(targets.values());
}

async function runMappedSyncs(domains: IndexerTriggerDomain[]): Promise<IndexerTriggerResult> {
  const syncTargets = mapDomainsToSyncTargets(domains);
  const syncResults: IndexerTriggerResult["sync_results"] = {};

  for (const target of syncTargets) {
    switch (target) {
      case "content":
        syncResults.content = await syncContentIndexOnce();
        break;
      case "proposal":
        syncResults.proposal = await syncProposalIndexOnce();
        break;
      case "reward":
        syncResults.reward = await syncRewardIndexOnce();
        break;
      case "stake":
        syncResults.stake = await syncStakeIndexOnce();
        break;
      case "system":
        syncResults.system = await syncSystemIndexOnce();
        break;
    }
  }

  return {
    triggered_domains: domains,
    sync_results: syncResults,
  };
}

export async function triggerIndexerSync(domains: IndexerTriggerDomain[]) {
  if (inFlightSync) {
    return inFlightSync;
  }

  inFlightSync = runMappedSyncs(domains).finally(() => {
    inFlightSync = null;
  });

  return inFlightSync;
}
