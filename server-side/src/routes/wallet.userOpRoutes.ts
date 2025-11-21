import type { Request, Response, Router } from "express";
import type { Address } from "viem";

import { buildDelegatedSendUO, getPermissionId, sendUserOpV07, UnpackedUserOperationV07 } from "../utils/native-code";
import { encodeFunctionData, parseAbi } from "viem";
import { KERNEL_ADDRESS } from "./wallet.constants";
import { buildBroadcastErrorResponse, ensureSufficientNativeBalance } from "./wallet.errors";

export function registerUserOperationRoutes(router: Router): void {
  // Route to prepare a User Operation for delegated send (directly from smart watch)
  router.post("/userOp/prepare", async (req: Request, res: Response) => {
    try {
      console.log("[userOp/prepare] -> req.body:", req.body);

      const { to, amountWei, data, delegatedEOA, kernelAddress, tokenAddress } = req.body ?? {};

      const permissionId = getPermissionId(delegatedEOA);

      console.log("[userOp/prepare] -> permissionId:", permissionId);

      if (!permissionId || typeof permissionId !== "string") {
        return res.status(400).json({ error: "permissionId is required" });
      }
      if (!to || typeof to !== "string") {
        return res.status(400).json({ error: "to is required" });
      }
      if (!amountWei || (typeof amountWei !== "string" && typeof amountWei !== "number")) {
        return res.status(400).json({ error: "amountWei is required (string or number)" });
      }
      const amtWei = BigInt(amountWei.toString());
      const callData = typeof data === "string" && data.startsWith("0x") ? data : "0x";
      let targetAddress = to as `0x${string}`;
      let finalCallData = callData as `0x${string}`;

      // If tokenAddress provided, build ERC20 transfer calldata and set target to token
      if (tokenAddress) {
        if (typeof tokenAddress !== "string" || !tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
          return res.status(400).json({ error: "tokenAddress must be a valid 0x-address" });
        }
        const erc20Abi = parseAbi(["function transfer(address to, uint256 amount)"]);
        finalCallData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [to as `0x${string}`, amtWei],
        });
        targetAddress = tokenAddress as `0x${string}`;
      }

      const { userOpHash } = await buildDelegatedSendUO(
        kernelAddress as `0x${string}`,
        permissionId,
        targetAddress,
        amtWei,
        finalCallData as `0x${string}`
      );

      console.log("[userOp/prepare] -> userOpHash:", userOpHash);

      return res.json({
        userOpHash,
        echo: { permissionId, to, amountWei: amtWei.toString(), data: callData },
      });
    } catch (err: any) {
      console.error("[/userOp/prepare] error:", err);
      return res.status(500).json({ error: err?.message ?? "internal error" });
    }
  });

  // Route to broadcast a prepared User Operation (directly from smart watch)
  router.post("/userOp/broadcast", async (req: Request, res: Response) => {
    let amtWei: bigint | null = null;
    let normalizedKernelAddress: Address | null = null;

    try {
      console.log("[userOp/broadcast] -> req.body:", req.body);

      const { to, amountWei, data, delegatedEOA, signature, opHash, kernelAddress, tokenAddress } = req.body ?? {};

      const permissionId = getPermissionId(delegatedEOA);

      console.log("[userOp/broadcast] -> permissionId:", permissionId);

      if (!permissionId || typeof permissionId !== "string") {
        return res.status(400).json({ error: "permissionId is required" });
      }
      if (!to || typeof to !== "string") {
        return res.status(400).json({ error: "to is required" });
      }
      if (!amountWei || (typeof amountWei !== "string" && typeof amountWei !== "number")) {
        return res.status(400).json({ error: "amountWei is required (string or number)" });
      }
      if (!signature || typeof signature !== "string" || !signature.startsWith("0x")) {
        return res.status(400).json({ error: "signature is required (0x-hex)" });
      }
      amtWei = BigInt(amountWei.toString());
      const callData = typeof data === "string" && data.startsWith("0x") ? data : "0x";
      normalizedKernelAddress = (kernelAddress as Address) ?? KERNEL_ADDRESS;

      if (normalizedKernelAddress && amtWei > 0n) {
        const { ok, availableWei } = await ensureSufficientNativeBalance(normalizedKernelAddress, amtWei);
        if (!ok) {
          return res.status(400).json({
            error: "Insufficient balance for this transaction.",
            details: {
              requestedWei: amtWei.toString(),
              availableWei: availableWei.toString(),
            },
          });
        }
      }

      let targetAddress = to as `0x${string}`;
      let finalCallData = callData as `0x${string}`;
      if (tokenAddress) {
        const erc20Abi = parseAbi(["function transfer(address to, uint256 amount)"]);
        finalCallData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [to as `0x${string}`, amtWei],
        });
        targetAddress = tokenAddress as `0x${string}`;
      }

      const { unpacked, userOpHash } = await buildDelegatedSendUO(
        kernelAddress as `0x${string}`,
        permissionId,
        targetAddress,
        amtWei,
        finalCallData as `0x${string}`,
        signature as `0x${string}`
      );

      console.log("[userOp/broadcast] -> userOpHash:", userOpHash);

      if (userOpHash !== opHash) {
        return res.status(400).json({ error: "userOpHash does not match opHash" });
      }

      const { txHash } = await sendUserOpV07(unpacked as UnpackedUserOperationV07);

      console.log("[userOp/broadcast] -> txHash:", txHash);

      return res.json({ txHash });
    } catch (err: any) {
      console.error("[/userOp/broadcast] error:", err);
      const { status, body } = await buildBroadcastErrorResponse(err, normalizedKernelAddress, amtWei);
      return res.status(status).json(body);
    }
  });
}
