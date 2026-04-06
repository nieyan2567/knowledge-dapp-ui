"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBlockNumber,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { toast } from "sonner";

import { GovernancePageLayout } from "@/components/governance/governance-page-layout";
import { ABIS, CONTRACTS } from "@/contracts";
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
import { reportClientError } from "@/lib/observability/client";
import { fetchParsedProposals } from "@/lib/proposal-events";
import { writeTxToast } from "@/lib/tx-toast";
import { asBigInt } from "@/lib/web3-types";
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
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const refreshAfterTx = useRefreshOnTxConfirmed();

  const [description, setDescription] = useState("提案：更新治理参数");
  const [draftActions, setDraftActions] = useState<GovernanceDraftAction[]>(() => [
    createGovernanceDraftAction("content.setRewardRules"),
  ]);
  const [highRiskConfirmed, setHighRiskConfirmed] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  const [liveBlockNumber, setLiveBlockNumber] = useState<bigint | undefined>(
    typeof blockNumber === "bigint" ? blockNumber : undefined
  );
  const latestProposal = proposals[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof blockNumber === "bigint") {
      setLiveBlockNumber(blockNumber);
    }
  }, [blockNumber]);

  useEffect(() => {
    if (!publicClient) return;

    let cancelled = false;

    const updateBlockNumber = async () => {
      try {
        const latestBlock = await publicClient.getBlockNumber();
        if (!cancelled) {
          setLiveBlockNumber(latestBlock);
        }
      } catch {
        // Keep the latest known block when polling fails transiently.
      }
    };

    void updateBlockNumber();
    const timer = window.setInterval(() => {
      void updateBlockNumber();
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [publicClient]);

  const templates = useMemo(() => getGovernanceTemplates(), []);
  const groupedTemplates = useMemo(() => groupGovernanceTemplates(templates), [templates]);

  const { data: proposalThreshold, refetch: refetchProposalThreshold } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalThreshold",
  });

  const { data: votingDelay, refetch: refetchVotingDelay } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "votingDelay",
  });

  const { data: votingPeriod, refetch: refetchVotingPeriod } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "votingPeriod",
  });

  const { data: proposalFee, refetch: refetchProposalFee } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalFee",
  });

  const { data: latestProposalState, refetch: refetchLatestProposalState } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "state",
    args: latestProposal ? [latestProposal.proposalId] : undefined,
    query: { enabled: !!latestProposal },
  });

  const { data: latestProposalEta, refetch: refetchLatestProposalEta } = useReadContract({
    address: CONTRACTS.KnowledgeGovernor as `0x${string}`,
    abi: ABIS.KnowledgeGovernor,
    functionName: "proposalEta",
    args: latestProposal ? [latestProposal.proposalId] : undefined,
    query: { enabled: !!latestProposal },
  });

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
  const latestProposalStateValue = asBigInt(latestProposalState);
  const latestProposalEtaValue = asBigInt(latestProposalEta);
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
    proposalFee !== undefined &&
    (!hasHighRiskAction || highRiskConfirmed);

  useEffect(() => {
    if (!latestProposal || liveBlockNumber === undefined) {
      return;
    }

    void Promise.all([refetchLatestProposalState(), refetchLatestProposalEta()]);
  }, [
    latestProposal,
    liveBlockNumber,
    refetchLatestProposalEta,
    refetchLatestProposalState,
  ]);

  useEffect(() => {
    if (!hasHighRiskAction && highRiskConfirmed) {
      setHighRiskConfirmed(false);
    }
  }, [hasHighRiskAction, highRiskConfirmed]);

  const loadProposals = useCallback(async () => {
    if (!publicClient) return;

    setLoadingProposals(true);
    try {
      const parsed = (await fetchParsedProposals(publicClient)).reverse();
      setProposals(parsed);
    } catch (error) {
      reportGovernancePageError("Failed to load governance proposals", error);
      toast.error(GOVERNANCE_PAGE_COPY.errors.loadProposalList);
    } finally {
      setLoadingProposals(false);
    }
  }, [publicClient]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  const governanceRefreshDomains = useMemo(
    () => ["governance", "system"] as const,
    []
  );

  const governanceRefetchers = useMemo(
    () => [
      loadProposals,
      refetchProposalThreshold,
      refetchProposalFee,
      refetchVotingDelay,
      refetchVotingPeriod,
    ],
    [
      loadProposals,
      refetchProposalFee,
      refetchProposalThreshold,
      refetchVotingDelay,
      refetchVotingPeriod,
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

    if (proposalFee === undefined) {
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
          value: typeof proposalFee === "bigint" ? proposalFee : 0n,
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
      proposalFee={typeof proposalFee === "bigint" ? proposalFee : undefined}
      proposalThreshold={typeof proposalThreshold === "bigint" ? proposalThreshold : undefined}
      votingDelay={typeof votingDelay === "bigint" ? votingDelay : undefined}
      votingPeriod={typeof votingPeriod === "bigint" ? votingPeriod : undefined}
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

