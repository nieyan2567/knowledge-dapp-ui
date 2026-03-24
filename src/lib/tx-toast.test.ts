import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportClientError } from "@/lib/observability/client";
import {
  classifyTransactionError,
  writeTxToast,
} from "@/lib/tx-toast";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/observability/client", () => ({
  reportClientError: vi.fn(),
}));

describe("tx-toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies wrong-chain wallet errors", () => {
    const result = classifyTransactionError(
      new Error(
        "The current chain of the wallet does not match the target chain"
      ),
      "交易失败"
    );

    expect(result.category).toBe("wrong_chain");
    expect(result.report).toBe(false);
  });

  it("classifies insufficient-funds errors", () => {
    const result = classifyTransactionError(
      new Error("insufficient funds for gas * price + value"),
      "交易失败"
    );

    expect(result.category).toBe("insufficient_funds");
    expect(result.report).toBe(false);
  });

  it("classifies simulation failures separately when no specific reason is found", () => {
    const result = classifyTransactionError(
      new Error("simulation failed unexpectedly"),
      "交易失败",
      "simulation"
    );

    expect(result.category).toBe("simulation_failed");
    expect(result.phase).toBe("simulation");
  });

  it("classifies known revert messages as contract reverts", () => {
    const result = classifyTransactionError(
      new Error("already voted"),
      "交易失败"
    );

    expect(result.category).toBe("contract_revert");
    expect(result.message).toContain("投票");
  });

  it("does not report user-rejected simulation errors", async () => {
    const publicClient = {
      simulateContract: vi
        .fn()
        .mockRejectedValue({ code: 4001, message: "User rejected the request" }),
    };
    const writeContractAsync = vi.fn();

    const result = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: "0x1234567890abcdef1234567890abcdef12345678",
        abi: [],
        functionName: "deposit",
      },
      loading: "loading",
      success: "success",
      fail: "fail",
    });

    expect(result).toBeNull();
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it("reports classified submission failures with category context", async () => {
    const publicClient = {
      simulateContract: vi.fn().mockResolvedValue(undefined),
    };
    const writeContractAsync = vi
      .fn()
      .mockRejectedValue(new Error("insufficient funds for gas * price + value"));

    const result = await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: "0x1234567890abcdef1234567890abcdef12345678",
        abi: [],
        functionName: "deposit",
      },
      loading: "loading",
      success: "success",
      fail: "fail",
    });

    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it("reports unknown submission failures to observability", async () => {
    const publicClient = {
      simulateContract: vi.fn().mockResolvedValue(undefined),
    };
    const writeContractAsync = vi
      .fn()
      .mockRejectedValue(new Error("unexpected wallet explosion"));

    await writeTxToast({
      publicClient,
      writeContractAsync,
      request: {
        address: "0x1234567890abcdef1234567890abcdef12345678",
        abi: [],
        functionName: "deposit",
      },
      loading: "loading",
      success: "success",
      fail: "fail",
    });

    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "fail",
        source: "tx-toast",
        context: expect.objectContaining({
          category: "wallet_internal_error",
          phase: "submission",
        }),
      })
    );
  });
});
