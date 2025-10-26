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
  buildInstallCallPolicyUO,
  buildEnableSelectorUO,
  buildGrantAccessUO,
  buildUninstallPermissionUO,
  buildDepositUserOp,
  getRootCurrentNonce,
  checkPrefund,
  CallPolicyPermission,
  getCallPolicyPermissionsCount,
  getCallPolicyPermissionByIndex,
  getCallPolicyDailyUsage,
  getCallPolicyDailyUsageToday,
  getAllCallPolicyPermissionsWithUsage,
  getCurrentDay,
  buildUpdatePermissionLimitsUO
} from "../utils/native-code";
import { parseEther } from 'viem';
import { InstallationStatus } from "../services/websocket";
import { wsService } from "../index";

const router = Router();

// Helper function to check prefund status directly
interface PrefundStatus {
  hasPrefund: boolean;
  message: string;
  depositWei: string;
  requiredPrefundWei: string;
  shortfallWei: string;
}

async function checkPrefundSimple(): Promise<PrefundStatus> {
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
    
    const depositStr = deposit.toString();
    const requiredStr = finalRequiredPrefund.toString();
    const shortfall = deposit >= finalRequiredPrefund ? 0n : finalRequiredPrefund - deposit;
    const shortfallStr = shortfall.toString();
    
    if (deposit >= finalRequiredPrefund) {
      return { 
        hasPrefund: true, 
        message: "Sufficient prefund available",
        depositWei: depositStr,
        requiredPrefundWei: requiredStr,
        shortfallWei: shortfallStr
      };
    } else {
      return { 
        hasPrefund: false, 
        message: `Insufficient prefund: Account has ${depositStr} wei but needs at least ${requiredStr} wei deposited in EntryPoint. Shortfall: ${shortfallStr} wei`,
        depositWei: depositStr,
        requiredPrefundWei: requiredStr,
        shortfallWei: shortfallStr
      };
    }
  } catch (error: any) {
    console.error(`[Prefund Check] Error:`, error);
    return { 
      hasPrefund: false, 
      message: `Prefund check failed: ${error.message}`,
      depositWei: '0',
      requiredPrefundWei: '0',
      shortfallWei: '0'
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
        message: result.message,
        depositWei: result.depositWei,
        requiredPrefundWei: result.requiredPrefundWei,
        shortfallWei: result.shortfallWei
      });
    } else {
      return res.status(400).json({
        hasPrefund: false,
        error: "Insufficient prefund",
        message: result.message,
        depositWei: result.depositWei,
        requiredPrefundWei: result.requiredPrefundWei,
        shortfallWei: result.shortfallWei
      });
    }
  } catch (err: any) {
    console.error("[/prefund/check] error:", err);
    return res.status(500).json({
      hasPrefund: false,
      error: "Prefund check failed",
      message: "Failed to check prefund status",
      details: err?.message ?? "internal error",
      depositWei: '0',
      requiredPrefundWei: '0',
      shortfallWei: '0'
    });
  }
});

/**
 * EntryPoint status (alias for prefund check with additional details)
 */
router.get("/entrypoint/status", async (_req: Request, res: Response) => {
  try {
    const result = await checkPrefundSimple();
    return res.json(result);
  } catch (err: any) {
    console.error("[/entrypoint/status] error:", err);
    return res.status(500).json({
      hasPrefund: false,
      message: "Failed to fetch EntryPoint status",
      error: err?.message ?? "internal error",
      depositWei: '0',
      requiredPrefundWei: '0',
      shortfallWei: '0'
    });
  }
});

/**
 * Health check endpoint
 */
router.get("/health", async (_req: Request, res: Response) => {
  try {
    return res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Server is running"
    });
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      message: err?.message ?? "Health check failed"
    });
  }
});

/**
 * Fetch CallPolicy permissions from smart contract
 */
router.post("/callpolicy/fetch", async (req: Request, res: Response) => {
  try {
    const { kernelAddress, delegatedEOA, permissionId } = req.body;
    
    if (!kernelAddress || !delegatedEOA || !permissionId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "kernelAddress, delegatedEOA, and permissionId are required"
      });
    }
    
    console.log(`[CallPolicy/Fetch] Fetching permissions for:`, {
      kernelAddress,
      delegatedEOA,
      permissionId
    });
    
    const { fetchCallPolicyPermissions } = await import('../utils/native-code');
    const permissions = await fetchCallPolicyPermissions(
      kernelAddress as `0x${string}`,
      delegatedEOA as `0x${string}`,
      permissionId as `0x${string}`
    );
    
    console.log(`[CallPolicy/Fetch] Found ${permissions.length} permissions`);
    
    // Convert BigInt values to strings for JSON serialization
    const serializedPermissions = permissions.map(permission => ({
      ...permission,
      valueLimit: permission.valueLimit.toString(),
      dailyLimit: permission.dailyLimit.toString(),
      rules: permission.rules.map(rule => ({
        ...rule,
        offset: rule.offset.toString(),
        params: rule.params
      }))
    }));
    
    return res.json({
      success: true,
      permissions: serializedPermissions,
      count: serializedPermissions.length,
      message: `Successfully fetched ${serializedPermissions.length} permissions from contract`
    });
    
  } catch (err: any) {
    console.error("[/callpolicy/fetch] error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch CallPolicy permissions",
      message: err?.message ?? "internal error",
      details: err?.stack
    });
  }
});

/**
 * Check if a specific permission exists on contract
 */
router.post("/callpolicy/check", async (req: Request, res: Response) => {
  try {
    const { kernelAddress, delegatedEOA, permissionId, callType, target, selector } = req.body;
    
    if (!kernelAddress || !delegatedEOA || !permissionId || callType === undefined || !target || !selector) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "All parameters are required: kernelAddress, delegatedEOA, permissionId, callType, target, selector"
      });
    }
    
    console.log(`[CallPolicy/Check] Checking permission:`, {
      kernelAddress,
      delegatedEOA,
      permissionId,
      callType,
      target,
      selector
    });
    
    const { checkPermissionExists } = await import('../utils/native-code');
    const exists = await checkPermissionExists(
      kernelAddress as `0x${string}`,
      delegatedEOA as `0x${string}`,
      permissionId as `0x${string}`,
      callType,
      target as `0x${string}`,
      selector as `0x${string}`
    );
    
    return res.json({
      success: true,
      exists,
      message: exists ? "Permission exists" : "Permission does not exist"
    });
    
  } catch (err: any) {
    console.error("[/callpolicy/check] error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to check permission",
      message: err?.message ?? "internal error",
      details: err?.stack
    });
  }
});

router.post("/callpolicy/regenerate", async (req: Request, res: Response) => {
  try {
    const { kernelAddress, delegatedEOA } = req.body;
    
    if (!kernelAddress || !delegatedEOA) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "kernelAddress and delegatedEOA are required"
      });
    }
    
    console.log(`[CallPolicy/Regenerate] Regenerating permission ID for:`, {
      kernelAddress,
      delegatedEOA
    });
    
    const { getPermissionId, getVId } = await import('../utils/native-code');
    const permissionId = getPermissionId(delegatedEOA as `0x${string}`);
    const vId = getVId(permissionId);
    
    console.log(`[CallPolicy/Regenerate] Generated permissionId:`, permissionId);
    console.log(`[CallPolicy/Regenerate] Generated vId:`, vId);
    
    return res.json({
      success: true,
      permissionId,
      vId,
      message: 'Permission ID regenerated successfully'
    });
    
  } catch (err: any) {
    console.error("[/callpolicy/regenerate] error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to regenerate permission ID",
      message: err?.message ?? "internal error",
      details: err?.stack
    });
  }
});

/**
 * Get permissions count for a specific policy and owner
 */
router.post("/callpolicy/count", async (req: Request, res: Response) => {
  try {
    const { policyId, owner } = req.body;
    
    if (!policyId || !owner) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "policyId and owner are required"
      });
    }
    
    console.log(`[CallPolicy/Count] Getting permissions count for:`, {
      policyId,
      owner
    });
    
    const count = await getCallPolicyPermissionsCount(
      policyId as `0x${string}`,
      owner as `0x${string}`
    );
    
    return res.json({
      success: true,
      count,
      message: `Found ${count} permissions`
    });
    
  } catch (err: any) {
    console.error("[/callpolicy/count] error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to get permissions count",
      message: err?.message ?? "internal error",
      details: err?.stack
    });
  }
});

/**
 * Get permission by index
 */
router.post("/callpolicy/get-by-index", async (req: Request, res: Response) => {
  try {
    const { policyId, owner, index } = req.body;
    
    if (!policyId || !owner || index === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "policyId, owner, and index are required"
      });
    }
    
    console.log(`[CallPolicy/GetByIndex] Getting permission at index:`, {
      policyId,
      owner,
      index
    });
    
    const permission = await getCallPolicyPermissionByIndex(
      policyId as `0x${string}`,
      owner as `0x${string}`,
      index
    );
    
    if (!permission) {
      return res.status(404).json({
        success: false,
        error: "Permission not found",
        message: `No permission found at index ${index}`
      });
    }
    
    // Convert BigInt values to strings for JSON serialization
    const serializedPermission = {
      ...permission,
      valueLimit: permission.valueLimit.toString(),
      dailyLimit: permission.dailyLimit.toString(),
      rules: permission.rules.map(rule => ({
        ...rule,
        offset: rule.offset.toString(),
        params: rule.params
      }))
    };
    
    return res.json({
      success: true,
      permission: serializedPermission,
      message: "Permission retrieved successfully"
    });
    
  } catch (err: any) {
    console.error("[/callpolicy/get-by-index] error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to get permission by index",
      message: err?.message ?? "internal error",
      details: err?.stack
    });
  }
});

/**
 * Get daily usage for a permission
 */
router.post("/callpolicy/daily-usage", async (req: Request, res: Response) => {
  try {
    const { policyId, wallet, permissionHash, day } = req.body;
    
    if (!policyId || !wallet || !permissionHash || day === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "policyId, wallet, permissionHash, and day are required"
      });
    }
    
    console.log(`[CallPolicy/DailyUsage] Getting daily usage for:`, {
      policyId,
      wallet,
      permissionHash,
      day
    });
    
    const usage = await getCallPolicyDailyUsage(
      policyId as `0x${string}`,
      wallet as `0x${string}`,
      permissionHash as `0x${string}`,
      day
    );
    
    return res.json({
      success: true,
      usage: usage.toString(),
      day,
      message: `Daily usage for day ${day}: ${usage.toString()}`
    });
    
  } catch (err: any) {
    console.error("[/callpolicy/daily-usage] error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to get daily usage",
      message: err?.message ?? "internal error",
      details: err?.stack
    });
  }
});

/**
 * Update permission limits
 */
router.post("/callpolicy/update-limits", async (req: Request, res: Response) => {
  try {
    const { 
      policyId, 
      wallet, 
      callType, 
      target, 
      selector, 
      newValueLimit, 
      newDailyLimit 
    } = req.body;
    
    if (!policyId || !wallet || callType === undefined || !target || !selector || 
        newValueLimit === undefined || newDailyLimit === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "All parameters are required: policyId, wallet, callType, target, selector, newValueLimit, newDailyLimit"
      });
    }
    
    console.log(`[CallPolicy/UpdateLimits] Updating limits for:`, {
      policyId,
      wallet,
      callType,
      target,
      selector,
      newValueLimit,
      newDailyLimit
    });
    
    const { unpacked } = await buildUpdatePermissionLimitsUO(
      policyId as `0x${string}`,
      wallet as `0x${string}`,
      callType,
      target as `0x${string}`,
      selector as `0x${string}`,
      BigInt(newValueLimit),
      BigInt(newDailyLimit)
    );
    
    return res.json({
      success: true,
      userOp: unpacked,
      message: "Permission limits update user operation created successfully"
    });
    
  } catch (err: any) {
    console.error("[/callpolicy/update-limits] error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to create update limits user operation",
      message: err?.message ?? "internal error",
      details: err?.stack
    });
  }
});

/**
 * Get all permissions with daily usage for a policy
 */
router.post("/callpolicy/all-permissions-with-usage", async (req: Request, res: Response) => {
  try {
    const { policyId, owner } = req.body;
    
    if (!policyId || !owner) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "policyId and owner are required"
      });
    }
    
    console.log(`[CallPolicy/AllPermissionsWithUsage] Getting all permissions with usage for:`, {
      policyId,
      owner
    });
    
    const permissions = await getAllCallPolicyPermissionsWithUsage(
      policyId as `0x${string}`,
      owner as `0x${string}`
    );
    
    // Convert BigInt values to strings for JSON serialization
    const serializedPermissions = permissions.map(permission => ({
      ...permission,
      valueLimit: permission.valueLimit.toString(),
      dailyLimit: permission.dailyLimit.toString(),
      dailyUsage: permission.dailyUsage.toString(),
      rules: permission.rules.map(rule => ({
        ...rule,
        offset: rule.offset.toString(),
        params: rule.params
      }))
    }));
    
    return res.json({
      success: true,
      permissions: serializedPermissions,
      count: serializedPermissions.length,
      message: `Found ${serializedPermissions.length} permissions with daily usage`
    });
    
  } catch (err: any) {
    console.error("[/callpolicy/all-permissions-with-usage] error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to get all permissions with usage",
      message: err?.message ?? "internal error",
      details: err?.stack
    });
  }
});

/**
 * Get daily usage for today
 */
router.post("/callpolicy/daily-usage-today", async (req: Request, res: Response) => {
  try {
    const { policyId, wallet, permissionHash } = req.body;
    
    if (!policyId || !wallet || !permissionHash) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "policyId, wallet, and permissionHash are required"
      });
    }
    
    console.log(`[CallPolicy/DailyUsageToday] Getting today's usage for:`, {
      policyId,
      wallet,
      permissionHash
    });
    
    const usage = await getCallPolicyDailyUsageToday(
      policyId as `0x${string}`,
      wallet as `0x${string}`,
      permissionHash as `0x${string}`
    );
    
    const currentDay = getCurrentDay();
    
    return res.json({
      success: true,
      usage: usage.toString(),
      day: currentDay,
      message: `Today's usage (day ${currentDay}): ${usage.toString()}`
    });
    
  } catch (err: any) {
    console.error("[/callpolicy/daily-usage-today] error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to get today's daily usage",
      message: err?.message ?? "internal error",
      details: err?.stack
    });
  }
});

/**
 * Get current day number
 */
router.get("/callpolicy/current-day", async (req: Request, res: Response) => {
  try {
    const currentDay = getCurrentDay();
    
    return res.json({
      success: true,
      day: currentDay,
      message: `Current day: ${currentDay}`
    });
    
  } catch (err: any) {
    console.error("[/callpolicy/current-day] error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to get current day",
      message: err?.message ?? "internal error",
      details: err?.stack
    });
  }
});

/**
 * Deposit ETH into the EntryPoint contract for the kernel account
 */
router.post("/entrypoint/deposit", async (req: Request, res: Response) => {
  try {
    console.log('[entrypoint/deposit] -> Request received:', req.body);
    
    const { amountEth } = req.body ?? {};
    const amountStr = amountEth?.toString() ?? '0.01';
    const parsedAmount = Number(amountStr);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.log('[entrypoint/deposit] -> Invalid amount:', amountStr);
      return res.status(400).json({
        error: "Invalid amount",
        message: "Deposit amount must be a positive number",
      });
    }

    const amountWei = parseEther(amountStr);
    console.log('[entrypoint/deposit] -> Parsed amount:', amountStr, 'ETH =', amountWei.toString(), 'wei');
    
    console.log('[entrypoint/deposit] -> Building deposit UserOp for', amountStr, 'ETH');
    
    // Add more detailed error handling for buildDepositUserOp
    let depositUserOp;
    try {
      depositUserOp = await buildDepositUserOp(amountWei);
      console.log('[entrypoint/deposit] -> Deposit UserOp built successfully');
    } catch (buildError: any) {
      console.error('[entrypoint/deposit] -> Error building UserOp:', buildError);
      return res.status(500).json({
        success: false,
        error: "Failed to build deposit UserOp",
        message: buildError?.message ?? "UserOp build error",
        details: buildError?.stack
      });
    }
    
    console.log('[entrypoint/deposit] -> Sending UserOp to bundler...');
    
    // Add more detailed error handling for sendUserOpV07
    let txHash;
    try {
      txHash = await sendUserOpV07(depositUserOp.unpacked);
      console.log('[entrypoint/deposit] -> Deposit submitted. TxHash:', txHash);
    } catch (sendError: any) {
      console.error('[entrypoint/deposit] -> Error sending UserOp:', sendError);
      return res.status(500).json({
        success: false,
        error: "Failed to send UserOp to bundler",
        message: sendError?.message ?? "UserOp send error",
        details: sendError?.stack
      });
    }
    
    return res.json({
      success: true,
      txHash,
      message: `Deposited ${amountStr} ETH to EntryPoint`,
    });
  } catch (err: any) {
    console.error("[/entrypoint/deposit] error:", err);
    console.error("[/entrypoint/deposit] error stack:", err?.stack);
    return res.status(500).json({
      success: false,
      error: "Failed to deposit to EntryPoint",
      message: err?.message ?? "internal error",
      details: err?.stack
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
 * Install CallPolicy with custom restrictions for delegated key
 * Body:
 * {
 *   "delegatedEOA": "0x...",  // string (required) - delegated EOA address
 *   "permissions": [          // array (required) - CallPolicy permissions
 *     {
 *       "callType": 0,        // number (required) - 0 = CALLTYPE_SINGLE, 1 = CALLTYPE_DELEGATECALL
 *       "target": "0x...",   // string (required) - target contract address
 *       "selector": "0x...", // string (required) - function selector
 *       "valueLimit": "0",   // string (required) - maximum value in wei
 *       "rules": [           // array (optional) - parameter rules
 *         {
 *           "condition": 0,  // number (required) - ParamCondition enum
 *           "offset": 0,     // number (required) - parameter offset
 *           "params": ["0x..."] // array (required) - rule parameters
 *         }
 *       ]
 *     }
 *   ]
 * }
 * Response:
 * {
 *   "permissionId": "0x...",
 *   "vId": "0x...",
 *   "txHash": "0x..."
 * }
 */
router.post("/delegated/install-callpolicy", async (req: Request, res: Response) => {
  try {
    console.log('[delegated/install-callpolicy] -> req.body:', req.body);
    
    const { delegatedEOA, permissions } = req.body ?? {};
    
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
    
    if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ 
        error: "permissions is required and must be a non-empty array of CallPolicy permissions" 
      });
    }
    
    // Validate permissions structure
    for (let i = 0; i < permissions.length; i++) {
      const perm = permissions[i];
      if (!perm.callType || typeof perm.callType !== "number") {
        return res.status(400).json({ 
          error: `permissions[${i}].callType is required and must be a number (0 or 1)` 
        });
      }
      if (!perm.target || typeof perm.target !== "string") {
        return res.status(400).json({ 
          error: `permissions[${i}].target is required and must be a valid Ethereum address` 
        });
      }
      if (!perm.selector || typeof perm.selector !== "string") {
        return res.status(400).json({ 
          error: `permissions[${i}].selector is required and must be a 4-byte hex string` 
        });
      }
      if (perm.valueLimit === undefined || perm.valueLimit === null) {
        return res.status(400).json({ 
          error: `permissions[${i}].valueLimit is required and must be a string or number` 
        });
      }
    }
    
    // Convert permissions to the expected format (convert ETH to wei)
    const callPolicyPermissions: CallPolicyPermission[] = permissions.map(perm => {
      const ethValue = parseFloat(perm.valueLimit.toString());
      const weiValue = Math.floor(ethValue * 1e18);
      const ethDailyValue = parseFloat((perm.dailyLimit || 0).toString());
      const weiDailyValue = Math.floor(ethDailyValue * 1e18);
      return {
        callType: perm.callType,
        target: perm.target as `0x${string}`,
        selector: (perm.selector === '0x' ? '0x00000000' : perm.selector) as `0x${string}`,
        valueLimit: BigInt(weiValue), // Convert ETH to wei
        dailyLimit: BigInt(weiDailyValue), // NEW: Convert daily limit ETH to wei
        rules: (perm.rules || []).map((rule: any) => ({
          condition: rule.condition,
          offset: rule.offset,
          params: rule.params || []
        }))
      };
    });
    
    console.log('[delegated/install-callpolicy] -> Building install CallPolicy UO for:', delegatedEOA);
    const { unpacked: installUO, permissionId, vId } = await buildInstallCallPolicyUO(
      delegatedEOA as `0x${string}`, 
      callPolicyPermissions
    );
    
    console.log('[delegated/install-callpolicy] -> Sending user operation...');
    const txHash = await sendUserOpV07(installUO);
    
    console.log('[delegated/install-callpolicy] -> Success! permissionId:', permissionId, 'vId:', vId, 'txHash:', txHash);
    
    return res.json({
      permissionId,
      vId,
      txHash
    });
  } catch (err: any) {
    console.error("[/delegated/install-callpolicy] error:", err);
    return res.status(500).json({ 
      error: "Failed to install CallPolicy permission validation",
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
 *   "keyType": "sudo" | "restricted" | "callpolicy", // string (required)
 *   "clientId": "unique_id",   // string (optional) - for WebSocket updates
 *   "permissions": [...]       // array (required for callpolicy) - CallPolicy permissions
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
    
    const { delegatedEOA, keyType, clientId, permissions } = req.body ?? {};
    
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

    if (!keyType || !['sudo', 'restricted', 'callpolicy'].includes(keyType)) {
      return res.status(400).json({ 
        error: "keyType is required and must be either 'sudo', 'restricted', or 'callpolicy'" 
      });
    }
    
    // For callpolicy, validate permissions
    if (keyType === 'callpolicy') {
      if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
        return res.status(400).json({ 
          error: "permissions is required for callpolicy keyType and must be a non-empty array" 
        });
      }
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
    performDelegatedKeyInstallation(installationId, delegatedEOA, keyType, clientId, permissions);
    
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
  keyType: 'sudo' | 'restricted' | 'callpolicy',
  clientId?: string,
  permissions?: any[]
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

    let installTxHash: string;
    let permissionId: string;
    let vId: string;
    
    if (keyType === 'callpolicy') {
    // Convert permissions to the expected format (convert ETH to wei)
      const callPolicyPermissions: CallPolicyPermission[] = permissions!.map(perm => {
        const ethValue = parseFloat(perm.valueLimit.toString());
        const weiValue = Math.floor(ethValue * 1e18);
        const ethDailyValue = parseFloat((perm.dailyLimit || 0).toString());
        const weiDailyValue = Math.floor(ethDailyValue * 1e18);
        return {
          callType: perm.callType,
          target: perm.target as `0x${string}`,
          selector: (perm.selector === '0x' ? '0x00000000' : perm.selector) as `0x${string}`,
          valueLimit: BigInt(weiValue), // Convert ETH to wei
          dailyLimit: BigInt(weiDailyValue), // NEW: Convert daily limit ETH to wei
          rules: (perm.rules || []).map((rule: any) => ({
            condition: rule.condition,
            offset: rule.offset,
            params: rule.params || []
          }))
      };
    });

    // Print CallPolicy restrictions in a clear format
    console.log('\n🔒 ===== CALLPOLICY RESTRICTIONS SETUP =====');
    console.log(`📱 Delegated Key: ${delegatedEOA}`);
    
    // Extract unique targets and actions from permissions
    const uniqueTargets = [...new Set(callPolicyPermissions.map(p => p.target))];
    const uniqueSelectors = [...new Set(callPolicyPermissions.map(p => p.selector))];
    
    console.log('\n🎯 ALLOWED TARGET ADDRESSES:');
    uniqueTargets.forEach((target, index) => {
      console.log(`   ${index + 1}. ${target}`);
    });
    
    console.log('\n⚡ ALLOWED FUNCTION SELECTORS:');
    uniqueSelectors.forEach((selector, index) => {
      const actionName = selector === '0x00000000' ? 'ETH Transfer' : 
                        selector === '0xa9059cbb' ? 'Transfer' :
                        selector === '0x095ea7b3' ? 'Approve' :
                        selector === '0x23b872dd' ? 'Transfer From' :
                        selector === '0x38ed1739' ? 'Swap' :
                        selector === '0xa694fc3a' ? 'Stake' :
                        selector === '0x2e17de78' ? 'Unstake' :
                        selector === '0x379607f5' ? 'Claim Rewards' :
                        selector === '0x47e7ef24' ? 'Deposit' :
                        selector === '0x2e1a7d4d' ? 'Withdraw' : 'Unknown';
      console.log(`   ${index + 1}. ${actionName} (${selector})`);
    });
    
    console.log('\n🔐 GENERATED PERMISSIONS:');
    callPolicyPermissions.forEach((perm, index) => {
      const actionName = perm.selector === '0x00000000' ? 'ETH Transfer' : 
                        perm.selector === '0xa9059cbb' ? 'Transfer' :
                        perm.selector === '0x095ea7b3' ? 'Approve' :
                        perm.selector === '0x23b872dd' ? 'Transfer From' :
                        perm.selector === '0x38ed1739' ? 'Swap' :
                        perm.selector === '0xa694fc3a' ? 'Stake' :
                        perm.selector === '0x2e17de78' ? 'Unstake' :
                        perm.selector === '0x379607f5' ? 'Claim Rewards' :
                        perm.selector === '0x47e7ef24' ? 'Deposit' :
                        perm.selector === '0x2e1a7d4d' ? 'Withdraw' : 'Unknown';
      const ethValue = (Number(perm.valueLimit) / 1e18).toFixed(6);
      const ethDailyValue = (Number(perm.dailyLimit) / 1e18).toFixed(6);
      console.log(`   ${index + 1}. ${actionName}`);
      console.log(`      Target: ${perm.target}`);
      console.log(`      Selector: ${perm.selector}`);
      console.log(`      Value Limit: ${ethValue} ETH`);
      console.log(`      Daily Limit: ${ethDailyValue} ETH`);
      console.log(`      Rules: ${perm.rules.length > 0 ? JSON.stringify(perm.rules, null, 8) : 'None'}`);
      console.log('');
    });
    console.log('🔒 ===========================================\n');
      
      const { unpacked: installUO, permissionId: permId, vId: vid } = await buildInstallCallPolicyUO(
        delegatedEOA as `0x${string}`, 
        callPolicyPermissions
      );
      installTxHash = await sendUserOpV07(installUO);
      permissionId = permId;
      vId = vid;
      
      // Log the assigned IDs
      console.log(`🔑 Permission ID: ${permissionId}`);
      console.log(`🆔 Validation ID: ${vId}`);
    } else {
      const { unpacked: installUO, permissionId: permId, vId: vid } = await buildInstallPermissionUO(delegatedEOA as `0x${string}`);
      installTxHash = await sendUserOpV07(installUO);
      permissionId = permId;
      vId = vid;
    }
    
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
    } else if (keyType === 'callpolicy') {
      // For CallPolicy: still need to grant access to execute selector
      sendStatus({
        step: 'granting',
        message: 'Granting access to execute selector for CallPolicy...',
        progress: 70
      });
      
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
    const keyTypeDisplay = keyType === 'sudo' ? 'Sudo' : keyType === 'restricted' ? 'Restricted' : 'CallPolicy';
    sendStatus({
      step: 'completed',
      message: `${keyTypeDisplay} delegated key created successfully!`,
      progress: 100,
      permissionId,
      vId
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
