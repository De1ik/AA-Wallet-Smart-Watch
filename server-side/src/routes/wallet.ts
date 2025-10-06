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
  getRootCurrentNonce,
  checkPrefund
} from "../utils/native-code";
import { parseEther } from 'viem';
import { InstallationStatus } from "../services/websocket";
import { wsService } from "../index";

const router = Router();

// Helper function to check prefund status directly
async function checkPrefundSimple(): Promise<{ hasPrefund: boolean; message: string }> {
  try {
    const KERNEL = '0xB115dc375D7Ad88D7c7a2180D0E548Cb5B83D86A';
    const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
    
    // Import required functions
    const { createPublicClient, http, parseAbi, parseEther } = await import('viem');
    const { sepolia } = await import('viem/chains');
    const { getCurrentGasPrices, getOptimizedGasLimits } = await import('../utils/native-code');
    
    const ETH_RPC_URL = 'https://sepolia.infura.io/v3/7df085afafad4becaad36c48fb162932';
    const publicClient = createPublicClient({ chain: sepolia, transport: http(ETH_RPC_URL) });
    
    const entryPointAbi = parseAbi([
      "function balanceOf(address account) view returns (uint256)"
    ]);
    
    const deposit = await publicClient.readContract({
      address: ENTRY_POINT as `0x${string}`,
      abi: entryPointAbi,
      functionName: "balanceOf",
      args: [KERNEL as `0x${string}`],
    }) as bigint;
    
    console.log(`[Prefund Check] Kernel deposit: ${deposit.toString()} wei`);
    
    // Get dynamic gas prices and calculate required prefund
    const { maxFeePerGas } = await getCurrentGasPrices();
    const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits('install');
    
    // Calculate required prefund based on dynamic gas prices
    const requiredPrefund = (preVerificationGas + verificationGasLimit + callGasLimit) * maxFeePerGas;
    const minRequiredPrefund = parseEther('0.001'); // Minimum fallback
    const finalRequiredPrefund = requiredPrefund > minRequiredPrefund ? requiredPrefund : minRequiredPrefund;
    
    console.log(`[Prefund Check] Required prefund: ${finalRequiredPrefund.toString()} wei (${Number(finalRequiredPrefund) / 1e18} ETH)`);
    
    if (deposit >= finalRequiredPrefund) {
      return { hasPrefund: true, message: "Sufficient prefund available" };
    } else {
      const shortfall = finalRequiredPrefund - deposit;
      return { 
        hasPrefund: false, 
        message: `Insufficient prefund: Account has ${deposit.toString()} wei but needs at least ${finalRequiredPrefund.toString()} wei deposited in EntryPoint. Shortfall: ${shortfall.toString()} wei`
      };
    }
  } catch (error: any) {
    console.error(`[Prefund Check] Error:`, error);
    return { 
      hasPrefund: false, 
      message: `Prefund check failed: ${error.message}` 
    };
  }
}

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
 * Check prefund status for the kernel account
 * Response:
 * {
 *   "hasPrefund": true/false,
 *   "deposit": "1000000000000000",
 *   "message": "Sufficient prefund available"
 * }
 */
router.get("/prefund/check", async (_req: Request, res: Response) => {
  try {
    console.log('[prefund/check] -> Checking prefund status...');
    
    const result = await checkPrefundSimple();
    
    if (result.hasPrefund) {
      return res.json({
        hasPrefund: true,
        message: result.message
      });
    } else {
      return res.status(400).json({
        hasPrefund: false,
        error: "Insufficient prefund",
        message: result.message
      });
    }
  } catch (err: any) {
    console.error("[/prefund/check] error:", err);
    return res.status(500).json({
      hasPrefund: false,
      error: "Prefund check failed",
      message: "Failed to check prefund status",
      details: err?.message ?? "internal error"
    });
  }
});

/**
 * Get current gas prices
 * Response:
 * {
 *   "maxFeePerGas": "5000000000",
 *   "maxPriorityFeePerGas": "1000000000",
 *   "maxFeePerGasGwei": "5",
 *   "maxPriorityFeePerGasGwei": "1"
 * }
 */
router.get("/gas/prices", async (_req: Request, res: Response) => {
  try {
    console.log('[gas/prices] -> Fetching current gas prices...');
    
    const { getCurrentGasPrices } = await import('../utils/native-code');
    const { maxFeePerGas, maxPriorityFeePerGas } = await getCurrentGasPrices();
    
    return res.json({
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      maxFeePerGasGwei: (Number(maxFeePerGas) / 1e9).toFixed(2),
      maxPriorityFeePerGasGwei: (Number(maxPriorityFeePerGas) / 1e9).toFixed(2)
    });
  } catch (err: any) {
    console.error("[/gas/prices] error:", err);
    return res.status(500).json({
      error: "Failed to fetch gas prices",
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

/**
 * Simplified delegated key creation with automatic status tracking
 * Body:
 * {
 *   "delegatedEOA": "0x...",  // string (required) - delegated EOA address
 *   "keyType": "sudo" | "restricted", // string (required)
 *   "clientId": "unique_id"   // string (optional) - for WebSocket updates
 * }
 * Response:
 * {
 *   "success": true,
 *   "installationId": "unique_id",
 *   "message": "Installation started"
 * }
 */
router.post("/delegated/create", async (req: Request, res: Response) => {
  try {
    console.log('[delegated/create] -> req.body:', req.body);
    
    const { delegatedEOA, keyType, clientId } = req.body ?? {};
    
    // Validation
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

    if (!keyType || !['sudo', 'restricted'].includes(keyType)) {
      return res.status(400).json({ 
        error: "keyType is required and must be either 'sudo' or 'restricted'" 
      });
    }

    // Generate unique installation ID
    const installationId = Math.random().toString(36).substring(7);
    
    // Check prefund before starting installation
    try {
      const prefundResult = await checkPrefundSimple();
      if (!prefundResult.hasPrefund) {
        console.error(`[Installation ${installationId}] Prefund check failed:`, prefundResult.message);
        return res.status(400).json({
          error: "Insufficient funds",
          message: prefundResult.message,
          details: prefundResult.message
        });
      }
    } catch (prefundError: any) {
      console.error(`[Installation ${installationId}] Prefund check failed:`, prefundError);
      return res.status(400).json({
        error: "Prefund check failed",
        message: "Failed to check account balance. Please try again.",
        details: prefundError.message
      });
    }
    
    // Start the installation process asynchronously
    performDelegatedKeyInstallation(installationId, delegatedEOA, keyType, clientId);
    
    return res.json({
      success: true,
      installationId,
      message: "Installation started"
    });
  } catch (err: any) {
    console.error("[/delegated/create] error:", err);
    return res.status(500).json({ 
      error: "Failed to start delegated key creation",
      details: err?.message ?? "internal error" 
    });
  }
});

// Async function to handle the complete installation process
async function performDelegatedKeyInstallation(
  installationId: string, 
  delegatedEOA: string, 
  keyType: 'sudo' | 'restricted',
  clientId?: string
) {
  const sendStatus = (status: InstallationStatus) => {
    console.log(`[Installation ${installationId}] Status:`, status);
    if (clientId) {
      wsService.broadcastToClient(clientId, status);
    } else {
      wsService.broadcastToAll(status);
    }
  };

  try {
    // Step 1: Installing
    sendStatus({
      step: 'installing',
      message: 'Installing permission validation...',
      progress: 10
    });

    const { unpacked: installUO, permissionId, vId } = await buildInstallPermissionUO(delegatedEOA as `0x${string}`);
    const installTxHash = await sendUserOpV07(installUO);
    
    console.log(`[Installation ${installationId}] Install tx:`, installTxHash);
    
    sendStatus({
      step: 'installing',
      message: 'Waiting for install transaction to be mined...',
      progress: 30,
      txHash: installTxHash
    });

    // Wait for install transaction to be confirmed
    await waitForNonceUpdate(installationId, sendStatus, 50);

    // Step 2: Granting Access
    sendStatus({
      step: 'granting',
      message: 'Granting access to execute selector...',
      progress: 60
    });

    let grantTxHash: string;

    if (keyType === 'sudo') {
      // For sudo: just grant access
      const { unpacked: grantUO } = await buildGrantAccessUO(vId as `0x${string}`, '0xe9ae5c53' as `0x${string}`, true);
      grantTxHash = await sendUserOpV07(grantUO);
    } else {
      // For restricted: enable selector first, then grant access
      const { unpacked: enableUO } = await buildEnableSelectorUO(
        permissionId as `0x${string}`,
        vId as `0x${string}`,
        delegatedEOA as `0x${string}`,
        '0xe9ae5c53' as `0x${string}` // SEL_EXECUTE
      );
      
      sendStatus({
        step: 'granting',
        message: 'Enabling selector for restricted access...',
        progress: 70
      });

      const enableTxHash = await sendUserOpV07(enableUO);
      console.log(`[Installation ${installationId}] Enable tx:`, enableTxHash);
      
      // Wait for enable transaction
      await waitForNonceUpdate(installationId, sendStatus, 80);

      // Then grant access
      const { unpacked: grantUO } = await buildGrantAccessUO(vId as `0x${string}`, '0xe9ae5c53' as `0x${string}`, true);
      grantTxHash = await sendUserOpV07(grantUO);
    }

    console.log(`[Installation ${installationId}] Grant tx:`, grantTxHash);
    
    sendStatus({
      step: 'granting',
      message: 'Waiting for grant transaction to be mined...',
      progress: 85,
      txHash: grantTxHash
    });

    // Wait for grant transaction to be confirmed
    await waitForNonceUpdate(installationId, sendStatus, 95);

    // Step 3: Completed
    sendStatus({
      step: 'completed',
      message: `${keyType === 'sudo' ? 'Sudo' : 'Restricted'} delegated key created successfully!`,
      progress: 100
    });

    console.log(`[Installation ${installationId}] Completed successfully!`);
    console.log(`[Installation ${installationId}] Permission ID:`, permissionId);
    console.log(`[Installation ${installationId}] vId:`, vId);

  } catch (error: any) {
    console.error(`[Installation ${installationId}] Error:`, error);
    
    // Parse specific blockchain errors and provide user-friendly messages
    let errorMessage = error.message || 'Unknown error occurred';
    let userMessage = 'Installation failed due to a blockchain error';
    
    if (error.message?.includes('AA21 didn\'t pay prefund')) {
      userMessage = 'Insufficient funds: The account doesn\'t have enough ETH deposited in the EntryPoint to pay for transaction fees';
      errorMessage = 'AA21_PREFUND_ERROR: Account needs to deposit more ETH to the EntryPoint';
    } else if (error.message?.includes('AA23 reverted')) {
      userMessage = 'Transaction reverted: The smart contract execution failed';
      errorMessage = 'AA23_REVERTED: Smart contract execution failed';
    } else if (error.message?.includes('AA21')) {
      userMessage = 'Account Abstraction error: There was an issue with the smart account';
      errorMessage = 'AA_ERROR: Account Abstraction related error';
    } else if (error.message?.includes('timeout')) {
      userMessage = 'Transaction timeout: The operation took too long to complete';
      errorMessage = 'TIMEOUT_ERROR: Transaction confirmation timeout';
    } else if (error.message?.includes('RPC Request failed')) {
      userMessage = 'Network error: Unable to connect to the blockchain network';
      errorMessage = 'RPC_ERROR: Blockchain network connection failed';
    }
    
    sendStatus({
      step: 'failed',
      message: userMessage,
      progress: 0,
      error: errorMessage
    });
  }
}

// Helper function to wait for nonce updates
async function waitForNonceUpdate(
  installationId: string, 
  sendStatus: (status: InstallationStatus) => void,
  progressUpdate: number
) {
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();
  let attempts = 0;
  
  let rootNonceBefore = await getRootCurrentNonce();
  let rootNonceAfter = await getRootCurrentNonce();
  
  while (rootNonceAfter <= rootNonceBefore) {
    attempts++;
    const elapsedTime = Date.now() - startTime;
    
    if (elapsedTime > maxWaitTime) {
      throw new Error(`Transaction timeout: Transaction not confirmed after 5 minutes. Current nonce: ${rootNonceAfter}`);
    }
    
    console.log(`[Installation ${installationId}] Waiting for nonce update, attempt ${attempts}, current nonce: ${rootNonceAfter}`);
    
    await new Promise(r => setTimeout(r, 10000)); // Wait 10 seconds
    rootNonceAfter = await getRootCurrentNonce();
    
    // Update progress during waiting
    if (progressUpdate > 0) {
      sendStatus({
        step: 'installing', // Keep the current step
        message: `Waiting for transaction confirmation... (attempt ${attempts})`,
        progress: progressUpdate - 5
      });
    }
  }
  
  console.log(`[Installation ${installationId}] Nonce updated! ${rootNonceBefore} -> ${rootNonceAfter}`);
}

/**
 * Revoke delegated key access
 * Body:
 * {
 *   "delegatedEOA": "0x..."  // string (required) - delegated EOA address to revoke
 * }
 * Response:
 * {
 *   "success": true,
 *   "txHash": "0x...",
 *   "message": "Delegated key access revoked successfully"
 * }
 */
router.post("/revoke", async (req: Request, res: Response) => {
  try {
    const { delegatedEOA } = req.body ?? {};
    
    if (!delegatedEOA) {
      return res.status(400).json({
        error: "delegatedEOA is required",
        message: "Please provide the delegated EOA address to revoke"
      });
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(delegatedEOA)) {
      return res.status(400).json({
        error: "Invalid address format",
        message: "Please provide a valid Ethereum address (0x...)"
      });
    }

    console.log(`[revoke] -> Revoking access for delegated EOA: ${delegatedEOA}`);

    // Check prefund before starting revocation
    try {
      const prefundResult = await checkPrefundSimple();
      if (!prefundResult.hasPrefund) {
        console.error(`[revoke] Prefund check failed:`, prefundResult.message);
        return res.status(400).json({
          error: "Insufficient funds",
          message: prefundResult.message,
          details: prefundResult.message
        });
      }
    } catch (prefundError: any) {
      console.error(`[revoke] Prefund check failed:`, prefundError);
      return res.status(400).json({
        error: "Prefund check failed",
        message: "Failed to check account balance. Please try again.",
        details: prefundError.message
      });
    }

    // Import the uninstall function
    const { buildUninstallPermissionUO } = await import('../utils/native-code');
    
    // Build the uninstall user operation
    const { unpacked, permissionId, vId } = await buildUninstallPermissionUO(delegatedEOA as `0x${string}`);

    console.log(`[revoke] -> Permission ID: ${permissionId}`);
    console.log(`[revoke] -> vId: ${vId}`);
    
    // Send the user operation
    const txHash = await sendUserOpV07(unpacked);
    
    console.log(`[revoke] -> Revocation transaction sent: ${txHash}`);
    
    return res.json({
      success: true,
      txHash,
      message: "Delegated key access revoked successfully"
    });

  } catch (err: any) {
    console.error("[/revoke] error:", err);
    return res.status(500).json({
      error: "Revocation failed",
      message: err?.message ?? "Failed to revoke delegated key access",
      details: err?.message ?? "internal error"
    });
  }
});

export default router;