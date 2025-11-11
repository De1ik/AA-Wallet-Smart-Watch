import type { Address } from "viem";

import { UserOpExecutionError } from "../utils/native-code";
import { sepoliaClient } from "./wallet.constants";

// Ensure the address has sufficient native balance before sending UserOp
export async function ensureSufficientNativeBalance(
  address: Address,
  requiredWei: bigint
): Promise<{ ok: boolean; availableWei: bigint }> {
  try {
    const balance = await sepoliaClient.getBalance({ address });
    return {
      ok: balance >= requiredWei,
      availableWei: balance,
    };
  } catch (error) {
    console.warn("[userOp/broadcast] Failed to read ETH balance for check:", error);
    return {
      ok: true,
      availableWei: 0n,
    };
  }
}

// Interpret common error reasons into user-friendly messages
export function interpretFriendlyError(reason?: string): string | null {
  if (!reason) return null;
  const normalized = reason.toLowerCase();
  if (normalized.includes("insufficient")) {
    return "Insufficient balance for this transaction.";
  }
  if (normalized.includes("permission")) {
    return "Permission is not granted for this account. Approve it in the mobile app.";
  }
  if (normalized.includes("limit")) {
    return "Spending limit has been exceeded.";
  }
  if (normalized.includes("rule")) {
    return "Defined policy rules were violated for this transaction.";
  }
  return null;
}

// Build a standardized error response for UserOp broadcast failures
export async function buildBroadcastErrorResponse(
  err: any,
  kernelAddress: Address | null,
  amountWei: bigint | null
): Promise<{ status: number; body: Record<string, unknown> }> {
  const reason = err?.result?.revertReason || err?.error?.message || err?.message;
  const friendly = interpretFriendlyError(reason);
  if (friendly) {
    return { status: 400, body: { error: friendly } };
  }

  if (kernelAddress && amountWei && amountWei > 0n) {
    const balanceCheck = await ensureSufficientNativeBalance(kernelAddress, amountWei);
    if (!balanceCheck.ok) {
      return {
        status: 400,
        body: {
          error: "Insufficient balance for this transaction.",
          details: {
            requestedWei: amountWei.toString(),
            availableWei: balanceCheck.availableWei.toString(),
          },
        },
      };
    }
  }

  const body: Record<string, unknown> = {
    error: err?.message ?? "internal error",
  };

  if (err instanceof UserOpExecutionError && err.result) {
    body.txHash = err.result.txHash;
    body.userOpHash = err.result.userOpHash;
    body.success = err.result.success;
  }

  return {
    status: 500,
    body,
  };
}
