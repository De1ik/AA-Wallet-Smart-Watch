import { Address, parseEther } from "viem";

import { badRequest, ErrorResponse, HttpResult, internalError, ok } from "../../shared/http/apiResponse";
import { debugLog } from "../../shared/helpers/helper";
import {
  buildDepositUserOpUnsigned,
  PrepareDataForSigning,
  sendUserOpV07,
  SignedDataForDelegateInstallation,
} from "../../utils/native-code";
import { ENTRY_POINT } from "../../shared/constants/constants";
import { checkPrefundSimple } from "./prefund";
import { depositExecuteSchema, depositPrepareSchema, statusSchema } from "./schema";

export interface PrepareEntryPointDeposit {
  success: boolean;
  data: PrepareDataForSigning;
  message: string;
}

export interface ExecutedEntryPointDeposit {
  success: boolean;
  data: { txHash: string; gasUsed: string };
  message: string;
}

export async function handleEntrypointStatus(input: unknown): Promise<{ status: number; body: any }> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        hasPrefund: false,
        message: parsed.error.issues[0].message,
        depositWei: "0",
        requiredPrefundWei: "0",
        shortfallWei: "0",
        kernelAddress: "",
        entryPointAddress: ENTRY_POINT,
      },
    };
  }

  try {
    const result = await checkPrefundSimple(parsed.data.kernelAddress as Address);
    return { status: 200, body: result };
  } catch (err: any) {
    console.error("[/entrypoint/status] error:", err);
    return {
      status: 500,
      body: {
        hasPrefund: false,
        message: err?.message ?? "internal error",
        depositWei: "0",
        requiredPrefundWei: "0",
        shortfallWei: "0",
        kernelAddress: parsed.data.kernelAddress,
        entryPointAddress: ENTRY_POINT,
      },
    };
  }
}

export async function handlePrepareEntrypointDeposit(
  input: unknown
): Promise<HttpResult<PrepareEntryPointDeposit | ErrorResponse>> {
  debugLog("Preparing deposit for entry point:", input);

  const parsed = depositPrepareSchema.safeParse(input);
  if (!parsed.success) {
    return badRequest("Validation error", parsed.error.issues[0].message);
  }

  const { amountEth, kernelAddress } = parsed.data;

  try {
    const amountStr = amountEth.toString();
    debugLog("AMOUNT to DEPOSIT (ETH):", amountStr);

    const amountWei = parseEther(amountStr);

    let packed, unpacked, userOpHash;
    try {
      const result = await buildDepositUserOpUnsigned(amountWei, kernelAddress);
      ({ packed, unpacked, userOpHash } = result);
    } catch (buildError: any) {
      return internalError(buildError?.message ?? "UserOp build error", "Failed to build deposit UserOp");
    }

    debugLog("built for signing", { packed, unpacked, userOpHash });

    return ok({
      success: true,
      data: { packed, unpacked, userOpHash },
      message: "Deposit to entry point was successful",
    });
  } catch (err: any) {
    return internalError(err?.message ?? "Failed to deposit to EntryPoint", "Failed to deposit to EntryPoint");
  }
}

export async function handleExecuteEntrypointDeposit(
  input: unknown
): Promise<HttpResult<ExecutedEntryPointDeposit | ErrorResponse>> {
  debugLog("input execute deposit", input);
  const parsed = depositExecuteSchema.safeParse(input);
  if (!parsed.success) {
    return badRequest("Validation error", parsed.error.issues[0].message);
  }

  try {
    const { unpacked, signature } = parsed.data as SignedDataForDelegateInstallation;

    const sendResult = await sendUserOpV07({ ...unpacked, signature });
    debugLog("response execute deposit", sendResult);

    if (sendResult.success) {
      return ok({
        success: true,
        data: { txHash: sendResult.txHash, gasUsed: sendResult.gasUsed },
        message: "Deposit to entry point was successful",
      });
    }

    return ok({
      success: false,
      message: sendResult.revertReason ?? "Failed to deposit to entry point",
    });
  } catch (err: any) {
    debugLog("response execute deposit", err);
    return internalError(err?.message ?? "Failed to execute deposit to EntryPoint", "Failed to execute deposit to EntryPoint");
  }
}
