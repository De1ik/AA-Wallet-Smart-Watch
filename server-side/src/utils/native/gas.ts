import { Hex } from "viem";

import {
  FALLBACK_MAX_FEE_PER_GAS,
  FALLBACK_MAX_PRIORITY_FEE,
  FEE_MULTIPLIER,
  MAX_FEE_PER_GAS_LIMIT,
  MAX_PRIORITY_FEE_LIMIT,
  MIN_FEE_PER_GAS,
  MIN_PRIORITY_FEE,
} from "../../shared/constants/constants";
import { ENTRY_POINT } from "../../shared/constants/constants";
import { bundlerClient, publicClient } from "../../shared/clients/sepoliaClient";
import { UnpackedUserOperationV07 } from "./types";

export async function getCurrentGasPrices(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  try {
    let estimatedMaxFee: bigint | undefined;
    let estimatedPriorityFee: bigint | undefined;

    try {
      const feeData = await publicClient.estimateFeesPerGas();
      estimatedMaxFee = feeData.maxFeePerGas ?? feeData.gasPrice ?? undefined;
      estimatedPriorityFee = feeData.maxPriorityFeePerGas ?? undefined;
    } catch (estimateError) {
      console.warn("⚠️ estimateFeesPerGas failed, falling back to gasPrice:", estimateError);
    }

    if (!estimatedMaxFee) {
      estimatedMaxFee = await publicClient.getGasPrice();
    }

    if (!estimatedPriorityFee) {
      estimatedPriorityFee = estimatedMaxFee / 5n;
    }

    let maxFeePerGas = (estimatedMaxFee * FEE_MULTIPLIER) / 10n;
    let maxPriorityFeePerGas = estimatedPriorityFee;

    maxFeePerGas = maxFeePerGas < MIN_FEE_PER_GAS ? MIN_FEE_PER_GAS : maxFeePerGas;
    maxFeePerGas = maxFeePerGas > MAX_FEE_PER_GAS_LIMIT ? MAX_FEE_PER_GAS_LIMIT : maxFeePerGas;

    maxPriorityFeePerGas = maxPriorityFeePerGas < MIN_PRIORITY_FEE ? MIN_PRIORITY_FEE : maxPriorityFeePerGas;
    maxPriorityFeePerGas = maxPriorityFeePerGas > MAX_PRIORITY_FEE_LIMIT ? MAX_PRIORITY_FEE_LIMIT : maxPriorityFeePerGas;

    if (maxPriorityFeePerGas > maxFeePerGas) {
      maxPriorityFeePerGas = maxFeePerGas;
    }

    return {
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  } catch (error) {
    console.warn("⚠️ Failed to fetch dynamic gas prices, using fallback:", error);
    return {
      maxFeePerGas: FALLBACK_MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: FALLBACK_MAX_PRIORITY_FEE,
    };
  }
}

export function getOptimizedGasLimits(
  operation: "install" | "grant" | "enable" | "send" | "uninstall" | "update"
): {
  verificationGasLimit: bigint;
  callGasLimit: bigint;
  preVerificationGas: bigint;
} {
  switch (operation) {
    case "install":
    case "uninstall":
    case "update":
      return {
        verificationGasLimit: 350_000n,
        callGasLimit: 600_000n,
        preVerificationGas: 100_000n,
      };
    case "grant":
      return {
        verificationGasLimit: 300_000n,
        callGasLimit: 200_000n,
        preVerificationGas: 80_000n,
      };
    case "enable":
      return {
        verificationGasLimit: 220_000n,
        callGasLimit: 60_000n,
        preVerificationGas: 80_000n,
      };
    case "send":
      return {
        verificationGasLimit: 200_000n,
        callGasLimit: 220_000n,
        preVerificationGas: 80_000n,
      };
    default:
      return {
        verificationGasLimit: 300_000n,
        callGasLimit: 300_000n,
        preVerificationGas: 100_000n,
      };
  }
}

export async function estimateAndPatch(unpacked: UnpackedUserOperationV07) {
  try {
    const est = (await (bundlerClient as any).request({
      method: "eth_estimateUserOperationGas",
      params: [unpacked, ENTRY_POINT],
    })) as { preVerificationGas: Hex; verificationGasLimit: Hex; callGasLimit: Hex };

    unpacked.preVerificationGas = est.preVerificationGas;
    unpacked.verificationGasLimit = est.verificationGasLimit;
    unpacked.callGasLimit = est.callGasLimit;
  } catch {
    /* no-op */
  }
  return unpacked;
}
