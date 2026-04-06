import { FAUCET_COPY } from "@/lib/faucet/copy";

export type FaucetClaimRecord = {
  address: `0x${string}`;
  amount: string;
  txHash: `0x${string}`;
  claimedAt: string;
  ip: string | null;
};

export type FaucetClaimLock = {
  entries: Array<{
    key: string;
    token: string;
  }>;
};

export type FaucetClaimEligibilityResult =
  | {
      ok: true;
      amount: bigint;
      minAllowedBalance: bigint;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type FaucetClaimAuthorization = {
  amount: bigint;
  deadline: bigint;
  nonce: `0x${string}`;
  signature: `0x${string}`;
};

export type FaucetMaintenanceReport = {
  status: "ok" | "degraded";
  relayer: {
    address: `0x${string}`;
    balance: string;
    alertMinBalance: string;
  };
  topUp: {
    attempted: boolean;
    txHash?: `0x${string}`;
    amount?: string;
    funderAddress?: `0x${string}`;
    error?: string;
  };
  faucetVault: {
    address: `0x${string}`;
    balance: string;
    claimAmount: string;
    availableBudget: string;
    paused: boolean;
    alertMinBalance?: string;
  };
  issues: string[];
};

export class FaucetError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FaucetError";
    this.status = status;
  }
}

export class FaucetInfraError extends FaucetError {
  constructor(message: string = FAUCET_COPY.errors.serviceUnavailable) {
    super(message, 503);
    this.name = "FaucetInfraError";
  }
}

export class FaucetRateLimitError extends FaucetError {
  constructor(message: string) {
    super(message, 429);
    this.name = "FaucetRateLimitError";
  }
}

export function isFaucetError(error: unknown): error is FaucetError {
  return error instanceof FaucetError;
}
