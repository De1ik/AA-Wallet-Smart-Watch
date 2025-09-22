// server/routes/wallet.ts
import { Router } from "express";
import type { Request, Response } from "express";
import { buildDelegatedSendUO, getPermissionId, getVId, sendUserOpV07, UnpackedUserOperationV07 } from "../utils/native-code";

const router = Router();

/**
 * Healthcheck
 */
router.get("/test", async (_req: Request, res: Response) => {
  res.json({ message: "Backend is alive" });
});

/**
 * STEP 1: Client asks server to build delegated UserOp and return userOpHash
 * Body:
 * {
 *   "to": "0xRecipient...",              // string (required)
 *   "amountWei": "1000000000000000",     // string (required, in wei)
 *   "data": "0x..."                      // string (optional, default "0x")
 * }
 * Response:
 * {
 *   "userOpHash": "0x....",
 *   "echo": { permissionId, to, amountWei, data }
 * }
 */
router.post("/userOp/prepare", async (req: Request, res: Response) => {
  try {

    console.log('[userOp/prepare] -> req.body:', req.body);

    const { to, amountWei, data, delegatedEOA, kernelAddress } = req.body ?? {};

    const permissionId = getPermissionId(delegatedEOA);

    console.log('[userOp/prepare] -> permissionId:', permissionId);

    // Валидация
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
    const callData = (typeof data === "string" && data.startsWith("0x")) ? data : "0x";

    // Строим делегированную UO и получаем хэш
    const { userOpHash } = await buildDelegatedSendUO(
      kernelAddress as `0x${string}`,
      permissionId,
      to as `0x${string}`,
      amtWei,
      callData as `0x${string}`
    );

    console.log('[userOp/prepare] -> userOpHash:', userOpHash);

    // На первом шаге ничего не отправляем в сеть, только возвращаем хэш
    return res.json({
      userOpHash,
      echo: { permissionId, to, amountWei: amtWei.toString(), data: callData },
    });
  } catch (err: any) {
    console.error("[/userOp/prepare] error:", err);
    return res.status(500).json({ error: err?.message ?? "internal error" });
  }
});

/**
 * STEP 2: Client signs userOpHash and sends signature back for broadcast
 * Body:
 * {
 *   "to": "0xRecipient...",              // string (required)
 *   "amountWei": "1000000000000000",     // string (required)
 *   "data": "0x...",                     // string (optional, default "0x")
 *   "signature": "0x..."                 // string (required) — подпись userOpHash с часов
 * }
 * Response:
 * {
 *   "txHash": "0x..."
 * }
 */
router.post("/userOp/broadcast", async (req: Request, res: Response) => {
  try {

    console.log('[userOp/broadcast] -> req.body:', req.body);

    const { to, amountWei, data, delegatedEOA, signature, opHash, kernelAddress } = req.body ?? {};

    const permissionId = getPermissionId(delegatedEOA);

    console.log('[userOp/broadcast] -> permissionId:', permissionId);

    // Валидация
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
    const amtWei = BigInt(amountWei.toString());
    const callData = (typeof data === "string" && data.startsWith("0x")) ? data : "0x";

    // На втором шаге мы детерминированно восстанавливаем ту же UO…
    const { unpacked, userOpHash } = await buildDelegatedSendUO(
      kernelAddress as `0x${string}`,
      permissionId,
      to as `0x${string}`,
      amtWei,
      callData as `0x${string}`,
      signature as `0x${string}`
    );

    console.log('[userOp/broadcast] -> userOpHash:', userOpHash);

    if (userOpHash !== opHash) {
      return res.status(400).json({ error: "userOpHash does not match opHash" });
    }

    // Отправляем в сеть
    const txHash = await sendUserOpV07(unpacked as UnpackedUserOperationV07);

    console.log('[userOp/broadcast] -> txHash:', txHash);

    return res.json({ txHash });
  } catch (err: any) {
    console.error("[/userOp/broadcast] error:", err);
    return res.status(500).json({ error: err?.message ?? "internal error" });
  }
});

export default router;