// server/routes/wallet.ts
import { Router } from "express";
import type { Request, Response } from "express";
import { 
  buildDelegatedSendUO, 
  getPermissionId, 
  getVId, 
  sendUserOpV07, 
  UnpackedUserOperationV07,
  buildInstallPermissionUO,
  buildEnableSelectorUO,
  buildGrantAccessUO,
  buildUninstallPermissionUO,
  getRootCurrentNonce
} from "../utils/native-code";

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

/**
 * Get current root nonce
 * Response:
 * {
 *   "nonce": "123"
 * }
 */
router.get("/nonce/root", async (_req: Request, res: Response) => {
  try {
    console.log('[nonce/root] -> Fetching root nonce...');
    const nonce = await getRootCurrentNonce();
    console.log('[nonce/root] -> Root nonce:', nonce.toString());
    return res.json({ nonce: nonce.toString() });
  } catch (err: any) {
    console.error("[/nonce/root] error:", err);
    return res.status(500).json({ 
      error: "Failed to fetch root nonce",
      details: err?.message ?? "internal error" 
    });
  }
});

/**
 * Install permission validation for delegated key
 * Body:
 * {
 *   "delegatedEOA": "0x..."  // string (required) - delegated EOA address
 * }
 * Response:
 * {
 *   "permissionId": "0x...",
 *   "vId": "0x...",
 *   "txHash": "0x..."
 * }
 */
router.post("/delegated/install", async (req: Request, res: Response) => {
  try {
    console.log('[delegated/install] -> req.body:', req.body);
    
    const { delegatedEOA } = req.body ?? {};
    
    if (!delegatedEOA || typeof delegatedEOA !== "string") {
      return res.status(400).json({ 
        error: "delegatedEOA is required and must be a valid Ethereum address string" 
      });
    }
    
    if (!delegatedEOA.startsWith('0x') || delegatedEOA.length !== 42) {
      return res.status(400).json({ 
        error: "delegatedEOA must be a valid Ethereum address (0x + 40 hex chars)" 
      });
    }
    
    console.log('[delegated/install] -> Building install permission UO for:', delegatedEOA);
    const { unpacked: installUO, permissionId, vId } = await buildInstallPermissionUO(delegatedEOA as `0x${string}`);
    
    console.log('[delegated/install] -> Sending user operation...');
    const txHash = await sendUserOpV07(installUO);
    
    console.log('[delegated/install] -> Success! permissionId:', permissionId, 'vId:', vId, 'txHash:', txHash);
    
    return res.json({
      permissionId,
      vId,
      txHash
    });
  } catch (err: any) {
    console.error("[/delegated/install] error:", err);
    return res.status(500).json({ 
      error: "Failed to install permission validation",
      details: err?.message ?? "internal error" 
    });
  }
});

/**
 * Enable selector for delegated key
 * Body:
 * {
 *   "permissionId": "0x...",  // string (required)
 *   "vId": "0x...",          // string (required)
 *   "delegatedEOA": "0x..."  // string (required)
 * }
 * Response:
 * {
 *   "txHash": "0x..."
 * }
 */
router.post("/delegated/enable", async (req: Request, res: Response) => {
  try {
    console.log('[delegated/enable] -> req.body:', req.body);
    
    const { permissionId, vId, delegatedEOA } = req.body ?? {};
    
    if (!permissionId || typeof permissionId !== "string") {
      return res.status(400).json({ error: "permissionId is required and must be a string" });
    }
    if (!vId || typeof vId !== "string") {
      return res.status(400).json({ error: "vId is required and must be a string" });
    }
    if (!delegatedEOA || typeof delegatedEOA !== "string") {
      return res.status(400).json({ error: "delegatedEOA is required and must be a string" });
    }
    
    if (!delegatedEOA.startsWith('0x') || delegatedEOA.length !== 42) {
      return res.status(400).json({ 
        error: "delegatedEOA must be a valid Ethereum address (0x + 40 hex chars)" 
      });
    }
    
    console.log('[delegated/enable] -> Building enable selector UO...');
    const { unpacked: enableUO } = await buildEnableSelectorUO(
      permissionId as `0x${string}`,
      vId as `0x${string}`,
      delegatedEOA as `0x${string}`,
      '0xe9ae5c53' as `0x${string}` // SEL_EXECUTE
    );
    
    console.log('[delegated/enable] -> Sending user operation...');
    const txHash = await sendUserOpV07(enableUO);
    
    console.log('[delegated/enable] -> Success! txHash:', txHash);
    
    return res.json({ txHash });
  } catch (err: any) {
    console.error("[/delegated/enable] error:", err);
    return res.status(500).json({ 
      error: "Failed to enable selector",
      details: err?.message ?? "internal error" 
    });
  }
});

/**
 * Grant access to execute selector for delegated key
 * Body:
 * {
 *   "vId": "0x..."  // string (required)
 * }
 * Response:
 * {
 *   "txHash": "0x..."
 * }
 */
router.post("/delegated/grant", async (req: Request, res: Response) => {
  try {
    console.log('[delegated/grant] -> req.body:', req.body);
    
    const { vId } = req.body ?? {};
    
    if (!vId || typeof vId !== "string") {
      return res.status(400).json({ error: "vId is required and must be a string" });
    }
    
    console.log('[delegated/grant] -> Building grant access UO...');
    const { unpacked: grantUO } = await buildGrantAccessUO(vId as `0x${string}`, '0xe9ae5c53' as `0x${string}`, true);
    
    console.log('[delegated/grant] -> Sending user operation...');
    const txHash = await sendUserOpV07(grantUO);
    
    console.log('[delegated/grant] -> Success! txHash:', txHash);
    
    return res.json({ txHash });
  } catch (err: any) {
    console.error("[/delegated/grant] error:", err);
    return res.status(500).json({ 
      error: "Failed to grant access",
      details: err?.message ?? "internal error" 
    });
  }
});

/**
 * Uninstall permission validation for delegated key
 * Body:
 * {
 *   "delegatedEOA": "0x..."  // string (required) - delegated EOA address
 * }
 * Response:
 * {
 *   "permissionId": "0x...",
 *   "vId": "0x...",
 *   "txHash": "0x..."
 * }
 */
router.post("/delegated/uninstall", async (req: Request, res: Response) => {
  try {
    console.log('[delegated/uninstall] -> req.body:', req.body);
    
    const { delegatedEOA } = req.body ?? {};
    
    if (!delegatedEOA || typeof delegatedEOA !== "string") {
      return res.status(400).json({ 
        error: "delegatedEOA is required and must be a valid Ethereum address string" 
      });
    }
    
    if (!delegatedEOA.startsWith('0x') || delegatedEOA.length !== 42) {
      return res.status(400).json({ 
        error: "delegatedEOA must be a valid Ethereum address (0x + 40 hex chars)" 
      });
    }
    
    console.log('[delegated/uninstall] -> Building uninstall permission UO for:', delegatedEOA);
    const { unpacked: uninstallUO, permissionId, vId } = await buildUninstallPermissionUO(delegatedEOA as `0x${string}`);
    
    console.log('[delegated/uninstall] -> Sending user operation...');
    const txHash = await sendUserOpV07(uninstallUO);
    
    console.log('[delegated/uninstall] -> Success! permissionId:', permissionId, 'vId:', vId, 'txHash:', txHash);
    
    return res.json({
      permissionId,
      vId,
      txHash
    });
  } catch (err: any) {
    console.error("[/delegated/uninstall] error:", err);
    return res.status(500).json({ 
      error: "Failed to uninstall permission validation",
      details: err?.message ?? "internal error" 
    });
  }
});

export default router;