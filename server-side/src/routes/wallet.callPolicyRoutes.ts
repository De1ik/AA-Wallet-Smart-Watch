import type { Request, Response, Router } from "express";
import { Hex, pad } from "viem";

import {
  getDelegatedKey,
  getPolicyStatus,
  getCallPolicyPermissionsCount,
  getCallPolicyPermissionByIndex,
  getStoredPermission,
  getAllowedTokens,
  getAllowedRecipients,
  getTokenLimit,
  getTokenDailyUsage,
  getTokenDailyUsageInfo,
  isRecipientAllowed,
  getDelegatedKeyInfo,
  getAllCallPolicyPermissionsWithUsage,
  getPermissionId,
  getVId,
  getCurrentDay,
  decodePermissionHash,
} from "../utils/native-code";
import { CALL_POLICY, KERNEL } from "../utils/native/constants";
import { publicClient } from "../utils/native/clients";
import { callPolicyAbi } from "../utils/native/abi";

// Helper function to validate Ethereum address
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Helper function to validate bytes32
function isValidBytes32(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export function registerCallPolicyRoutes(router: Router): void {
  
  // ---------------- BASIC POLICY INFO ----------------
  
  /**
   * GET /callpolicy/:delegatedEOA/info
   * Get complete delegated key information
   */
  router.get("/callpolicy/:delegatedEOA/info", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.params;
      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const info = await getDelegatedKeyInfo(KERNEL, policyId);

      if (!info) {
        return res.status(404).json({ success: false, error: "Policy not found" });
      }

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        data: {
          delegatedKey: info.delegatedKey,
          status: info.status,
          statusText: info.status === 0 ? "NA" : info.status === 1 ? "Live" : "Deprecated",
          isActive: info.isActive,
          allowedTokens: info.allowedTokens.map(t => ({
            token: t.token,
            enabled: t.enabled,
            txLimit: t.txLimit.toString(),
            dailyLimit: t.dailyLimit.toString(),
          })),
          allowedRecipients: info.allowedRecipients,
        },
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/info] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  /**
   * GET /callpolicy/:delegatedEOA/status
   * Get policy status
   */
  router.get("/callpolicy/:delegatedEOA/status", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.params;
      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const status = await getPolicyStatus(KERNEL, policyId);

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        status,
        statusText: status === 0 ? "NA" : status === 1 ? "Live" : "Deprecated",
        isActive: status === 1,
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/status] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  /**
   * GET /callpolicy/:delegatedEOA/delegated-key
   * Get delegated key address
   */
  router.get("/callpolicy/:delegatedEOA/delegated-key", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.params;
      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const delegatedKey = await getDelegatedKey(KERNEL, policyId);

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        delegatedKey,
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/delegated-key] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // ---------------- PERMISSIONS ----------------

  /**
   * GET /callpolicy/:delegatedEOA/permissions-count
   * Get number of permissions
   */
  router.get("/callpolicy/:delegatedEOA/permissions-count", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.params;
      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const count = await getCallPolicyPermissionsCount(policyId, KERNEL);

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        count,
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/permissions-count] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  /**
   * GET /callpolicy/:delegatedEOA/permissions
   * Get all permissions
   */
  router.get("/callpolicy/:delegatedEOA/permissions", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.params;
      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const count = await getCallPolicyPermissionsCount(policyId, KERNEL);
      const permissions = [];

      for (let i = 0; i < count; i++) {
        const perm = await getCallPolicyPermissionByIndex(policyId, KERNEL, i);
        if (perm) {
          const decoded = decodePermissionHash(perm.permissionHash, perm.delegatedKey);
          permissions.push({
            index: i,
            permissionHash: perm.permissionHash,
            delegatedKey: perm.delegatedKey,
            callType: decoded.callType,
            target: decoded.target,
            selector: decoded.selector,
            rules: perm.rules.map(r => ({
              condition: r.condition,
              offset: r.offset.toString(),
              params: r.params,
            })),
          });
        }
      }

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        count: permissions.length,
        permissions,
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/permissions] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  /**
   * GET /callpolicy/:delegatedEOA/permission/:index
   * Get permission by index
   */
  router.get("/callpolicy/:delegatedEOA/permission/:index", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA, index } = req.params;
      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }

      const idx = Number(index);
      if (!Number.isInteger(idx) || idx < 0) {
        return res.status(400).json({ success: false, error: "index must be a non-negative integer" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const perm = await getCallPolicyPermissionByIndex(policyId, KERNEL, idx);

      if (!perm) {
        return res.status(404).json({ success: false, error: "Permission not found" });
      }
      const decoded = decodePermissionHash(perm.permissionHash, perm.delegatedKey);

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        index: idx,
        permission: {
          permissionHash: perm.permissionHash,
          delegatedKey: perm.delegatedKey,
          callType: decoded.callType,
          target: decoded.target,
          selector: decoded.selector,
          rules: perm.rules.map(r => ({
            condition: r.condition,
            offset: r.offset.toString(),
            params: r.params,
          })),
        },
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/permission/:index] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  /**
   * GET /callpolicy/:delegatedEOA/permission/hash/:permissionHash
   * Get permission by hash
   */
  router.get("/callpolicy/:delegatedEOA/permission/hash/:permissionHash", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA, permissionHash } = req.params;
      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }
      if (!isValidBytes32(permissionHash)) {
        return res.status(400).json({ success: false, error: "Invalid permissionHash (bytes32)" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const perm = await getStoredPermission(KERNEL, policyId, permissionHash as `0x${string}`);

      if (!perm || !perm.exists) {
        return res.status(404).json({ success: false, error: "Permission not found" });
      }
      const decoded = decodePermissionHash(permissionHash as `0x${string}`, perm.delegatedKey);

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        permissionHash,
        permission: {
          delegatedKey: perm.delegatedKey,
          callType: decoded.callType,
          target: decoded.target,
          selector: decoded.selector,
          rules: perm.rules.map(r => ({
            condition: r.condition,
            offset: r.offset.toString(),
            params: r.params,
          })),
        },
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/permission/hash/:permissionHash] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // ---------------- TOKENS ----------------

  /**
   * GET /callpolicy/:delegatedEOA/tokens
   * Get all allowed tokens with limits
   */
  router.get("/callpolicy/:delegatedEOA/tokens", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.params;
      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const tokens = await getAllowedTokens(KERNEL, policyId);

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        count: tokens.length,
        tokens: tokens.map(t => ({
          token: t.token,
          enabled: t.enabled,
          txLimit: t.txLimit.toString(),
          dailyLimit: t.dailyLimit.toString(),
        })),
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/tokens] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  /**
   * GET /callpolicy/:delegatedEOA/token-limit
   * Get token limit by address
   * Query param: token
   */
  router.get("/callpolicy/:delegatedEOA/token-limit", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.params;
      const { token } = req.query;

      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }
      if (!token || typeof token !== "string" || !isValidAddress(token)) {
        return res.status(400).json({ success: false, error: "Invalid token address" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const limit = await getTokenLimit(KERNEL, policyId, token as `0x${string}`);

      if (!limit) {
        return res.status(404).json({ success: false, error: "Token limit not found" });
      }

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        token,
        enabled: limit.enabled,
        txLimit: limit.txLimit.toString(),
        dailyLimit: limit.dailyLimit.toString(),
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/token-limit] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  /**
   * GET /callpolicy/:delegatedEOA/token-usage
   * Get token daily usage
   * Query params: token, day (optional)
   */
  router.get("/callpolicy/:delegatedEOA/token-usage", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.params;
      const { token, day } = req.query;

      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }
      if (!token || typeof token !== "string" || !isValidAddress(token)) {
        return res.status(400).json({ success: false, error: "Invalid token address" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const targetDay = day ? Number(day) : undefined;

      if (day !== undefined && (!Number.isInteger(targetDay) || targetDay! < 0)) {
        return res.status(400).json({ success: false, error: "day must be a non-negative integer" });
      }

      const usage = await getTokenDailyUsage(KERNEL, policyId, token as `0x${string}`, targetDay);

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        token,
        day: targetDay ?? getCurrentDay(),
        usage: usage.toString(),
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/token-usage] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  /**
   * GET /callpolicy/:delegatedEOA/token-usage-info
   * Get token daily usage with limit info
   * Query param: token
   */
  router.get("/callpolicy/:delegatedEOA/token-usage-info", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.params;
      const { token } = req.query;

      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }
      if (!token || typeof token !== "string" || !isValidAddress(token)) {
        return res.status(400).json({ success: false, error: "Invalid token address" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const usageInfo = await getTokenDailyUsageInfo(KERNEL, policyId, token as `0x${string}`);

      if (!usageInfo) {
        return res.status(404).json({ success: false, error: "Token not found or not configured" });
      }

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        token,
        day: getCurrentDay(),
        used: usageInfo.used.toString(),
        limit: usageInfo.limit.toString(),
        remaining: usageInfo.remaining.toString(),
        percentage: usageInfo.percentage,
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/token-usage-info] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // ---------------- RECIPIENTS ----------------

  /**
   * GET /callpolicy/:delegatedEOA/recipients
   * Get all allowed recipients
   */
  router.get("/callpolicy/:delegatedEOA/recipients", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.params;
      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const recipients = await getAllowedRecipients(KERNEL, policyId);

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        count: recipients.length,
        recipients,
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/recipients] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  /**
   * GET /callpolicy/:delegatedEOA/recipient-allowed
   * Check if recipient is allowed
   * Query param: recipient
   */
  router.get("/callpolicy/:delegatedEOA/recipient-allowed", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.params;
      const { recipient } = req.query;

      if (!isValidAddress(delegatedEOA)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedEOA address" });
      }
      if (!recipient || typeof recipient !== "string" || !isValidAddress(recipient)) {
        return res.status(400).json({ success: false, error: "Invalid recipient address" });
      }

      const policyId = getPermissionId(delegatedEOA as `0x${string}`);
      const allowed = await isRecipientAllowed(KERNEL, policyId, recipient as `0x${string}`);

      return res.json({
        success: true,
        delegatedEOA,
        policyId,
        recipient,
        allowed,
      });
    } catch (err: any) {
      console.error("[GET /callpolicy/:delegatedEOA/recipient-allowed] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // ---------------- LEGACY / UTILITY ROUTES ----------------

  /**
   * POST /callpolicy/regenerate
   * Regenerate permission ID and vId for a delegated key
   */
  router.post("/callpolicy/regenerate", async (req: Request, res: Response) => {
    try {
      const { kernelAddress, delegatedEOA } = req.body;

      if (!kernelAddress || !delegatedEOA) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameters",
          message: "kernelAddress and delegatedEOA are required",
        });
      }

      console.log(`[POST /callpolicy/regenerate] Regenerating permission ID for:`, {
        kernelAddress,
        delegatedEOA,
      });

      const permissionId = getPermissionId(delegatedEOA as `0x${string}`);
      const vId = getVId(permissionId);

      console.log(`[POST /callpolicy/regenerate] Generated permissionId:`, permissionId);
      console.log(`[POST /callpolicy/regenerate] Generated vId:`, vId);

      return res.json({
        success: true,
        permissionId,
        vId,
        message: "Permission ID regenerated successfully",
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/regenerate] error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to regenerate permission ID",
        message: err?.message ?? "internal error",
        details: err?.stack,
      });
    }
  });

  /**
   * POST /callpolicy/all-permissions-with-usage
   * Get all permissions with usage info (legacy)
   */
  router.post("/callpolicy/all-permissions-with-usage", async (req: Request, res: Response) => {
    try {
      const { policyId, owner } = req.body;

      if (!policyId || !owner) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameters",
          message: "policyId and owner are required",
        });
      }

      console.log(`[POST /callpolicy/all-permissions-with-usage] Getting all permissions with usage for:`, {
        policyId,
        owner,
      });

      const permissions = await getAllCallPolicyPermissionsWithUsage(policyId as `0x${string}`, owner as `0x${string}`);

      const serializedPermissions = permissions.map((permission) => ({
        ...permission,
        dailyUsage: permission.dailyUsage.toString(),
        rules: permission.rules.map((rule) => ({
          ...rule,
          offset: rule.offset.toString(),
          params: rule.params,
        })),
      }));

      return res.json({
        success: true,
        permissions: serializedPermissions,
        count: serializedPermissions.length,
        message: `Found ${serializedPermissions.length} permissions`,
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/all-permissions-with-usage] error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to get all permissions with usage",
        message: err?.message ?? "internal error",
        details: err?.stack,
      });
    }
  });
}
