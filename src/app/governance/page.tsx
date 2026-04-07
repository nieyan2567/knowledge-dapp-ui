"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { toast } from "sonner";

import { GovernancePageLayout } from "@/components/governance/governance-page-layout";
import { ABIS, CONTRACTS } from "@/contracts";
import { useLiveChainClock } from "@/hooks/useLiveChainClock";
import { useRefreshOnTxConfirmed } from "@/hooks/useRefreshOnTxConfirmed";
import { useTxEventRefetch } from "@/hooks/useTxEventRefetch";
import {
  createGovernanceDraftAction,
  encodeGovernanceActionDraft,
  getGovernanceTemplateById,
  getGovernanceTemplates,
  validateGovernanceActionDraft,
} from "@/lib/governance-templates";
import {
  GOVERNANCE_PAGE_COPY,
  getActiveGovernanceStep,
  getCurrentGovernanceStageText,
  groupGovernanceTemplates,
  MAX_GOVERNANCE_DRAFT_ACTIONS,
  moveGovernanceItem,
} from "@/lib/governance-page-helpers";
import { fetchIndexedSystemSnapshot } from "@/lib/indexer-api";
import {
  readProposalListWithFallback,
} from "@/lib/governance-chain";
import { reportClientError } from "@/lib/observability/client";
import { readGovernanceConfigFromChain } from "@/lib/system-chain";
import { writeTxToast } from "@/lib/tx-toast";
import type {
  GovernanceDraftAction,
  GovernanceTemplateDefinition,
  ProposalItem,
} from "@/types/governance";

type DraftActionState = {
  action: GovernanceDraftAction;
  template: GovernanceTemplateDefinition | null;
  validation:
    | { ok: true }
    | { ok: false; error: string };
  encodedAction:
    | ReturnType<typeof encodeGovernanceActionDraft>
    | null;
};

function reportGovernancePageError(message: string, error: unknown) {
  void reportClientError({
    message,
    source: "governance.page",
    severity: "error",
    handled: true,
    error,
  });
}

export default function GovernancePage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const refreshAfterTx = useRefreshOnTxConfirmed();
  const { nowTs, liveBlockNumber } = useLiveChainClock();

  const [description, setDescription] = useState("提案：更新治理参数");
  const [draftActions, setDraftActions] = useState<GovernanceDraftAction[]>(() => [
    createGovernanceDraftAction("content.setRewardRules"),
  ]);
  const [highRiskConfirmed, setHighRiskConfirmed] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [governanceConfig, setGovernanceConfig] = useState<{
    proposalThreshold: bigint;
    votingDelay: bigint;
    votingPeriod: bigint;
    proposalFee: bigint;
  }>({
    proposalThreshold: 0n,
    votingDelay: 0n,
    votingPeriod: 0n,
    proposalFee: 0n,
  });
  const latestProposal = proposals[0];

  const templates = useMemo(() => getGovernanceTemplates(), []);
  const groupedTemplates = useMemo(() => groupGovernanceTemplates(templates), [templates]);

  const draftStates = useMemo<DraftActionState[]>(() => {
    return draftActions.map((action) => {
      const template = getGovernanceTemplateById(action.templateId);
      const validation = validateGovernanceActionDraft(action);

      if (!validation.ok) {
        return {
          action,
          template,
          validation,
          encodedAction: null,
        };
      }

      try {
        return {
          action,
          template,
          validation,
          encodedAction: encodeGovernanceActionDraft(action),
        };
      } catch (error) {
        return {
          action,
          template,
          validation: {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : GOVERNANCE_PAGE_COPY.errors.encodeActionFailed,
          },
          encodedAction: null,
        };
      }
    });
  }, [draftActions]);

  const allActionsValid = draftStates.every((state) => state.validation.ok);
  const encodedActions = draftStates.flatMap((state) =>
    state.encodedAction ? [state.encodedAction] : []
  );
  const highRiskActionCount = encodedActions.filter(
    (action) => action.riskLevel === "high"
  ).length;
  const hasHighRiskAction = highRiskActionCount > 0;
  const trimmedDescription = description.trim();
  const latestProposalStateValue = latestProposal?.stateValue;
  const latestProposalEtaValue = latestProposal?.etaSecond;
  const activeGovernanceStep = useMemo(() => {
    return getActiveGovernanceStep({
      latestProposal,
      latestProposalStateValue,
      latestProposalEtaValue,
      liveBlockNumber,
      nowTs,
    });
  }, [
    latestProposal,
    latestProposalEtaValue,
    latestProposalStateValue,
    liveBlockNumber,
    nowTs,
  ]);
  const currentGovernanceStageText = useMemo(() => {
    return getCurrentGovernanceStageText({
      draftActionCount: draftActions.length,
      latestProposal,
      latestProposalEtaValue,
      latestProposalStateValue,
      nowTs,
      trimmedDescriptionLength: trimmedDescription.length,
    });
  }, [
    draftActions.length,
    latestProposal,
    latestProposalEtaValue,
    latestProposalStateValue,
    nowTs,
    trimmedDescription.length,
  ]);
  const canSubmitProposal =
    !!address &&
    trimmedDescription.length > 0 &&
    draftActions.length > 0 &&
    allActionsValid &&
    governanceConfig.proposalFee !== undefined &&
    (!hasHighRiskAction || highRiskConfirmed);

  useEffect(() => {
    if (!hasHighRiskAction && highRiskConfirmed) {
      setHighRiskConfirmed(false);
    }
  }, [hasHighRiskAction, highRiskConfirmed]);

  const loadProposals = useCallback(async () => {
    if (!publicClient) return;

    setLoadingProposals(true);
    try {
      setProposals(await readProposalListWithFallback(publicClient));
    } catch (error) {
      reportGovernancePageError("Failed to load governance proposals", error);
      toast.error(GOVERNANCE_PAGE_COPY.errors.loadProposalList);
    } finally {
      setLoadingProposals(false);
    }
  }, [publicClient]);

  const loadGovernanceConfig = useCallback(async () => {
    const indexedSnapshot = await fetchIndexedSystemSnapshot();

    if (indexedSnapshot) {
      setGovernanceConfig({
        proposalThreshold: BigInt(indexedSnapshot.proposal_threshold_amount),
        votingDelay: BigInt(indexedSnapshot.voting_delay_block),
        votingPeriod: BigInt(indexedSnapshot.voting_period_block),
        proposalFee: BigInt(indexedSnapshot.proposal_fee_amount),
      });
      return;
    }

    if (!publicClient) {
      setGovernanceConfig({
        proposalThreshold: 0n,
        votingDelay: 0n,
        votingPeriod: 0n,
        proposalFee: 0n,
      });
      return;
    }

    setGovernanceConfig(await readGovernanceConfigFromChain(publicClient));
  }, [publicClient]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    void loadGovernanceConfig();
  }, [loadGovernanceConfig]);

  const governanceRefreshDomains = useMemo(
    () => ["governance", "system"] as const,
    []
  );

  const governanceRefetchers = useMemo(
    () => [
      loadProposals,
      loadGovernanceConfig,
    ],
    [
      loadProposals,
      loadGovernanceConfig,
    ]
  );

  useTxEventRefetch(governanceRefreshDomains, governanceRefetchers);

  function handleTemplateChange(actionId: string, templateId: string) {
    const nextDraft = createGovernanceDraftAction(templateId);

    setDraftActions((current) =>
      current.map((action) =>
        action.id === actionId
          ? {
              ...nextDraft,
              id: action.id,
            }
          : action
      )
    );
  }

  function handleFieldChange(
    actionId: string,
    key: string,
    value: string | boolean
  ) {
    setDraftActions((current) =>
      current.map((action) =>
        action.id === actionId
          ? {
              ...action,
              values: {
                ...action.values,
                [key]: value,
              },
            }
          : action
      )
    );
  }

  function handleAddAction() {
    if (draftActions.length >= MAX_GOVERNANCE_DRAFT_ACTIONS) {
      toast.error(GOVERNANCE_PAGE_COPY.errors.addActionLimit);
      return;
    }

    const fallbackTemplateId =
      draftActions[draftActions.length - 1]?.templateId ?? templates[0]?.id;

    setDraftActions((current) => [
      ...current,
      createGovernanceDraftAction(fallbackTemplateId),
    ]);
  }

  function handleRemoveAction(actionId: string) {
    setDraftActions((current) => current.filter((action) => action.id !== actionId));
  }

  function handleMoveAction(actionId: string, direction: "up" | "down") {
    setDraftActions((current) => {
      const index = current.findIndex((action) => action.id === actionId);
      if (index === -1) {
        return current;
      }

      if (direction === "up" && index > 0) {
        return moveGovernanceItem(current, index, index - 1);
      }

      if (direction === "down" && index < current.length - 1) {
        return moveGovernanceItem(current, index, index + 1);
      }

      return current;
    });
  }

  async function handlePropose() {
    if (!address) {
      toast.error(GOVERNANCE_PAGE_COPY.errors.connectWallet);
      return;
    }

    if (!trimmedDescription) {
      toast.error(GOVERNANCE_PAGE_COPY.errors.missingDescription);
      return;
    }

    if (draftStates.length === 0) {
      toast.error("请至少添加一个提案动作");
      return;
    }

    const invalidDraft = draftStates.find((state) => !state.validation.ok);
    if (invalidDraft && !invalidDraft.validation.ok) {
      toast.error(invalidDraft.validation.error);
      return;
    }

    if (hasHighRiskAction && !highRiskConfirmed) {
      toast.error(GOVERNANCE_PAGE_COPY.errors.confirmHighRisk);
      return;
    }

    if (governanceConfig.proposalFee === undefined) {
      toast.error(GOVERNANCE_PAGE_COPY.errors.feeLoading);
      return;
    }

    const hash = await writeTxToast({
      publicClient,
      writeContractAsync,
        request: {
          address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
          abi: ABIS.KnowledgeGovernor,
          functionName: "proposeWithFee",
          args: [
            encodedActions.map((item) => item.target),
            encodedActions.map((item) => item.value),
            encodedActions.map((item) => item.calldata),
            trimmedDescription,
          ],
          value: governanceConfig.proposalFee,
          account: address,
        },
      loading: GOVERNANCE_PAGE_COPY.loading.submitProposal,
      success: GOVERNANCE_PAGE_COPY.success.submitProposal,
      fail: GOVERNANCE_PAGE_COPY.fail.submitProposal,
    });

    if (!hash) return;

    await refreshAfterTx(hash, loadProposals, ["governance", "system"]);
  }

  return (
    <GovernancePageLayout
      description={description}
      proposalFee={governanceConfig.proposalFee}
      proposalThreshold={governanceConfig.proposalThreshold}
      votingDelay={governanceConfig.votingDelay}
      votingPeriod={governanceConfig.votingPeriod}
      activeGovernanceStep={activeGovernanceStep}
      currentGovernanceStageText={currentGovernanceStageText}
      loadingProposals={loadingProposals}
      proposals={proposals}
      liveBlockNumber={liveBlockNumber}
      nowTs={nowTs}
      draftActions={draftActions}
      draftStates={draftStates}
      groupedTemplates={groupedTemplates}
      highRiskActionCount={highRiskActionCount}
      hasHighRiskAction={hasHighRiskAction}
      highRiskConfirmed={highRiskConfirmed}
      canSubmitProposal={canSubmitProposal}
      onDescriptionChange={setDescription}
      onAddAction={handleAddAction}
      onTemplateChange={handleTemplateChange}
      onFieldChange={handleFieldChange}
      onMoveAction={handleMoveAction}
      onRemoveAction={handleRemoveAction}
      onHighRiskConfirmedChange={setHighRiskConfirmed}
      onPropose={handlePropose}
    />
  );
}

