"use client";

import { useState } from "react";
import { formatEther } from "viem";
import { toast } from "sonner";
import { useBalance, useSignMessage } from "wagmi";

import {
  FaucetHeroSection,
  FaucetInfoGrid,
  FaucetPageTopbar,
  FaucetRequestCard,
} from "@/components/faucet/faucet-page-sections";
import { useWalletReady } from "@/hooks/useWalletReady";
import { BRANDING } from "@/lib/branding";
import { FAUCET_COPY } from "@/lib/faucet/copy";
import {
  buildFaucetClaimMessage,
  type FaucetAuthChallenge,
} from "@/lib/faucet/message";
import { reportClientError } from "@/lib/observability/client";
import { PAGE_TEST_IDS } from "@/lib/test-ids";

type FaucetClaimResponse = {
  ok?: boolean;
  txHash?: `0x${string}`;
  amount?: string;
  displayAmount?: string;
  address?: `0x${string}`;
  error?: string;
};

type FaucetNonceError = {
  error?: string;
};

function isUserRejectedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  const message = `${(error as { shortMessage?: string }).shortMessage ?? ""} ${
    (error as { message?: string }).message ?? ""
  }`.toLowerCase();

  return (
    code === 4001 ||
    code === "ACTION_REJECTED" ||
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("rejected the request") ||
    message.includes("denied message signature")
  );
}

function reportFaucetPageError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  void reportClientError({
    message,
    source: "faucet.page",
    severity: "error",
    handled: true,
    error,
    context,
  });
}

export default function FaucetPage() {
  const { address, isConnected, isCorrectChain } = useWalletReady();
  const { signMessageAsync } = useSignMessage();
  const { data: balance } = useBalance({
    address,
    query: { enabled: !!address },
  });

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [claimAmount, setClaimAmount] = useState<string | null>(null);

  async function handleClaim() {
    if (!address || !isConnected) {
      toast.error(FAUCET_COPY.page.connectWallet);
      return;
    }

    if (!isCorrectChain) {
      toast.error(`请先切换到 ${BRANDING.chainName}`);
      return;
    }

    setLoading(true);
    setTxHash(null);

    try {
      const nonceRes = await fetch(
        `/api/faucet/nonce?address=${encodeURIComponent(address)}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const nonceData = (await nonceRes.json()) as
        | FaucetAuthChallenge
        | FaucetNonceError;

      if (!nonceRes.ok || !("nonce" in nonceData)) {
        reportFaucetPageError(
          "Failed to create faucet auth challenge",
          "error" in nonceData ? nonceData.error : undefined,
          {
            address,
            status: nonceRes.status,
          }
        );
        toast.error(
          ("error" in nonceData && nonceData.error) ||
            FAUCET_COPY.page.claimRequestChallengeFailed
        );
        return;
      }

      const signature = await signMessageAsync({
        message: buildFaucetClaimMessage(nonceData, address),
      });

      const claimRes = await fetch("/api/faucet/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          address,
          nonce: nonceData.nonce,
          signature,
        }),
      });

      const claimData = (await claimRes.json()) as FaucetClaimResponse;

      if (!claimRes.ok || !claimData.ok || !claimData.txHash) {
        reportFaucetPageError("Faucet claim request failed", claimData.error, {
          address,
          status: claimRes.status,
        });
        toast.error(claimData.error || FAUCET_COPY.errors.claimFailed);
        return;
      }

      setTxHash(claimData.txHash);
      setClaimAmount(claimData.displayAmount || null);
      toast.success(FAUCET_COPY.page.claimSuccess);
    } catch (error) {
      if (isUserRejectedError(error)) {
        toast.info(FAUCET_COPY.page.signatureCancelled);
        return;
      }

      toast.error(
        error instanceof Error ? error.message : FAUCET_COPY.page.claimRequestFailed
      );
      reportFaucetPageError("Faucet request failed", error, { address });
    } finally {
      setLoading(false);
    }
  }

  const walletBalanceText = balance
    ? `${formatEther(balance.value)} ${balance.symbol}`
    : "--";

  return (
    <main
      data-testid={PAGE_TEST_IDS.faucet}
      className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.08),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.14),transparent_24%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-6 py-8 text-slate-900 dark:bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.12),transparent_26%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.16),transparent_24%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] dark:text-slate-100"
    >
      <div className="mx-auto max-w-6xl">
        <FaucetPageTopbar />

        <section className="grid gap-8 pt-12 lg:grid-cols-[minmax(0,1.15fr)_420px] lg:items-start">
          <FaucetHeroSection walletBalanceText={walletBalanceText} />

          <FaucetRequestCard
            address={address}
            isConnected={isConnected}
            isCorrectChain={isCorrectChain}
            loading={loading}
            txHash={txHash}
            claimAmount={claimAmount}
            onClaim={handleClaim}
          />
        </section>

        <FaucetInfoGrid />
      </div>
    </main>
  );
}
