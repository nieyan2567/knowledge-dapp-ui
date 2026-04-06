import "server-only";

import {
  FAUCET_COPY,
  getFaucetMinBalanceMessage,
} from "@/lib/faucet/copy";
import { getFaucetClients, readFaucetVaultConfig } from "@/lib/faucet/client";
import { formatFaucetAmount } from "@/lib/faucet/request-context";
import { getCooldownRemainingSeconds } from "@/lib/faucet/store";
import type { FaucetClaimEligibilityResult } from "@/lib/faucet/types";

export async function checkFaucetClaimEligibility(
  address: `0x${string}`,
  ip: string | null
): Promise<FaucetClaimEligibilityResult> {
  const cooldownRemainingSeconds = await getCooldownRemainingSeconds(address, ip);

  if (cooldownRemainingSeconds > 0) {
    return {
      ok: false,
      status: 429,
      error: FAUCET_COPY.formatters.cooldown(cooldownRemainingSeconds),
    };
  }

  const { publicClient } = await getFaucetClients();
  const config = await readFaucetVaultConfig();

  if (config.paused) {
    return {
      ok: false,
      status: 503,
      error: FAUCET_COPY.errors.paused,
    };
  }

  const [recipientBalance, faucetBalance] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.getBalance({ address: config.address }),
  ]);

  if (recipientBalance >= config.minAllowedBalance) {
    return {
      ok: false,
      status: 400,
      error: getFaucetMinBalanceMessage(
        formatFaucetAmount(config.minAllowedBalance)
      ),
    };
  }

  if (faucetBalance < config.claimAmount) {
    return {
      ok: false,
      status: 503,
      error: FAUCET_COPY.errors.vaultBalanceLow,
    };
  }

  if (config.availableBudget < config.claimAmount) {
    return {
      ok: false,
      status: 429,
      error: FAUCET_COPY.errors.budgetExhausted,
    };
  }

  return {
    ok: true,
    amount: config.claimAmount,
    minAllowedBalance: config.minAllowedBalance,
  };
}
