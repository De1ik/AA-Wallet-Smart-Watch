import type { Request, Response, Router } from "express";
import { Address, parseEther } from "viem";

import {
  buildDepositUserOpUnsigned,
  getCurrentGasPrices,
  getRootCurrentNonce,
  PrepareDataForSigning,
  SendUserOpResult,
  sendUserOpV07,
  SignedDataForDelegateInstallation,
} from "../utils/native-code";
import { ENTRY_POINT_ADDRESS } from "./wallet.constants";
import { checkPrefundSimple } from "./wallet.prefund";
import { badRequest, ErrorResponse, HttpResult, internalError, ok } from "../utils/apiResponse";
import { debugLog, executeUserOp } from "../utils/native/delegateKey/helper";

export function registerEntryPointRoutes(router: Router): void {
  // Route to get current gas prices
  router.get("/entrypoint/status", async (req: Request, res: Response) => {
    const kernelAddress = (req.body as any)?.kernelAddress ?? (req.query as any)?.kernelAddress;
    if (!kernelAddress || typeof kernelAddress !== "string") {
      return res.status(400).json({
        hasPrefund: false,
        message: "kernelAddress is required",
        depositWei: "0",
        requiredPrefundWei: "0",
        shortfallWei: "0",
        kernelAddress: kernelAddress ?? "",
        entryPointAddress: ENTRY_POINT_ADDRESS,
      });
    }
    try {
      const result = await checkPrefundSimple(kernelAddress as Address);
      return res.json(result);
    } catch (err: any) {
      console.error("[/entrypoint/status] error:", err);
      return res.status(500).json({
        hasPrefund: false,
        message: "Failed to fetch EntryPoint status",
        error: err?.message ?? "internal error",
        depositWei: "0",
        requiredPrefundWei: "0",
        shortfallWei: "0",
        kernelAddress: kernelAddress,
        entryPointAddress: ENTRY_POINT_ADDRESS,
      });
    }
  });

  router.post("/entrypoint/deposit/prepare-data", async (req: Request<any, any, EntryPointDepositPrepareInput>, res: Response<prepareEntryPointDeposit | ErrorResponse>) => {
    const result = await handlePrepareEntrypointDeposit(req.body);
    return res.status(result.status).json(result.body);
  });

  router.post("/entrypoint/deposit/execute", async (req: Request<any, any, SignedDataForDelegateInstallation>, res: Response<executedEntryPointDeposit | ErrorResponse>) => {
    const result = await handleExecuteEntrypointDeposit(req.body);
    return res.status(result.status).json(result.body);
  });
}


export interface EntryPointDepositPrepareInput {
  amountEth: string;
  kernelAddress: Address;
}


export interface prepareEntryPointDeposit {
  success: boolean;
  data: PrepareDataForSigning;
  message: string;
}

export interface executedEntryPointDeposit {
  success: boolean;
  data: { txHash: string; gasUsed: string };
  message: string;
}

export async function handlePrepareEntrypointDeposit(
  input: EntryPointDepositPrepareInput
): Promise<HttpResult<prepareEntryPointDeposit | ErrorResponse>>  {

  debugLog("Preparing deposit for entry point:", input);

  const { amountEth, kernelAddress } = input;

  try {

      const amountStr = amountEth?.toString() ?? "0.01";
      const parsedAmount = Number(amountStr);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return badRequest(
          "Invalid amount",
          "Deposit amount must be a positive number"
        );
      }

      debugLog("AMOUNT to DEPOSIT (ETH):", amountStr);

      const amountWei = parseEther(amountStr);

      let packed, unpacked, userOpHash;
      try {
        // Build the deposit User Operation
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
  input: SignedDataForDelegateInstallation
): Promise<HttpResult<executedEntryPointDeposit | ErrorResponse>>  {
  debugLog("input execute deposit", input);
  try {
    const { unpacked, signature } = input;

    // Ensure the signature we received is on the userOp we are about to send
    // if (signature) {
    //   unpacked.signature = signature;
    // }

    const sendResult = await sendUserOpV07(unpacked);
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
