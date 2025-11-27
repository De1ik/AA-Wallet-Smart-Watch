import type { Request, Response, Router } from "express";
import { parseEther } from "viem";

import {
  buildDepositUserOpUnsigned,
  getCurrentGasPrices,
  getRootCurrentNonce,
  SendUserOpResult,
  sendUserOpV07,
} from "../utils/native-code";
import { ENTRY_POINT_ADDRESS } from "./wallet.constants";
import { checkPrefundSimple } from "./wallet.prefund";

export function registerEntryPointRoutes(router: Router): void {
  // Route to get current gas prices
  router.get("/entrypoint/status", async (req: Request, res: Response) => {
    const { kernelAddress } = req.body ?? {};
    try {
      const result = await checkPrefundSimple(kernelAddress);
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

  // Route to deposit ETH into the EntryPoint contract
  router.post("/entrypoint/deposit", async (req: Request, res: Response) => {
    const { amountEth, kernelAddress } = req.body ?? {};
    try {
      console.log("[entrypoint/deposit] -> Request received:", req.body);
      const amountStr = amountEth?.toString() ?? "0.01";
      const parsedAmount = Number(amountStr);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        console.log("[entrypoint/deposit] -> Invalid amount:", amountStr);
        return res.status(400).json({
          error: "Invalid amount",
          message: "Deposit amount must be a positive number",
        });
      }

      const amountWei = parseEther(amountStr);
      console.log("[entrypoint/deposit] -> Parsed amount:", amountStr, "ETH =", amountWei.toString(), "wei");
      console.log("[entrypoint/deposit] -> Building deposit UserOp for", amountStr, "ETH");

      let depositUserOp;
      let packed, unpacked, userOpHash;
      try {
        // Build the deposit User Operation
        const result = await buildDepositUserOpUnsigned(amountWei, kernelAddress);
        ({ packed, unpacked, userOpHash } = result);
        console.log("[entrypoint/deposit] -> Deposit UserOp built successfully");
      } catch (buildError: any) {
        console.error("[entrypoint/deposit] -> Error building UserOp:", buildError);
        return res.status(500).json({
          success: false,
          error: "Failed to build deposit UserOp",
          message: buildError?.message ?? "UserOp build error",
          details: buildError?.stack,
          kernelAddress: kernelAddress,
          entryPointAddress: ENTRY_POINT_ADDRESS,
        });
      }

      console.log("[entrypoint/deposit] -> Sending UserOp to bundler...");

      return res.json({
        success: true,
        data: {
          packed, unpacked, userOpHash
        },
        message: "deposit to entry point",
      });
    } catch (err: any) {
      console.error("[/entrypoint/deposit] error:", err);
      console.error("[/entrypoint/deposit] error stack:", err?.stack);
      return res.status(500).json({
        success: false,
        error: "Failed to deposit to EntryPoint",
        message: err?.message ?? "internal error",
        details: err?.stack,
        kernelAddress: kernelAddress,
        entryPointAddress: ENTRY_POINT_ADDRESS,
      });
    }
  });
}
