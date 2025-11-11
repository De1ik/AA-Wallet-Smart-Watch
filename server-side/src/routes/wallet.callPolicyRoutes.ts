import type { Request, Response, Router } from "express";

import {
  buildUpdatePermissionLimitsUO,
  fetchCallPolicyPermissions,
  getAllCallPolicyPermissionsWithUsage,
  getCallPolicyDailyUsage,
  getCallPolicyDailyUsageToday,
  getCallPolicyPermissionByIndex,
  getCallPolicyPermissionsCount,
  getCurrentDay,
  getPermissionId,
  getVId,
} from "../utils/native-code";

export function registerCallPolicyRoutes(router: Router): void {
  // Route to fetch CallPolicy permissions (fallback)
  router.post("/callpolicy/fetch", async (req: Request, res: Response) => {
    try {
      const { kernelAddress, delegatedEOA, permissionId } = req.body;

      if (!kernelAddress || !delegatedEOA || !permissionId) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameters",
          message: "kernelAddress, delegatedEOA, and permissionId are required",
        });
      }

      console.log(`[CallPolicy/Fetch] Fetching permissions for:`, {
        kernelAddress,
        delegatedEOA,
        permissionId,
      });

      const permissions = await fetchCallPolicyPermissions(
        kernelAddress as `0x${string}`,
        delegatedEOA as `0x${string}`,
        permissionId as `0x${string}`
      );

      console.log(`[CallPolicy/Fetch] Found ${permissions.length} permissions`);

      const serializedPermissions = permissions.map((permission) => ({
        ...permission,
        valueLimit: permission.valueLimit.toString(),
        dailyLimit: permission.dailyLimit.toString(),
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
        message: `Successfully fetched ${serializedPermissions.length} permissions from contract`,
      });
    } catch (err: any) {
      console.error("[/callpolicy/fetch] error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch CallPolicy permissions",
        message: err?.message ?? "internal error",
        details: err?.stack,
      });
    }
  });

  // Route to regenerate permission ID and vId for a delegated key
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

      console.log(`[CallPolicy/Regenerate] Regenerating permission ID for:`, {
        kernelAddress,
        delegatedEOA,
      });

      const permissionId = getPermissionId(delegatedEOA as `0x${string}`);
      const vId = getVId(permissionId);

      console.log(`[CallPolicy/Regenerate] Generated permissionId:`, permissionId);
      console.log(`[CallPolicy/Regenerate] Generated vId:`, vId);

      return res.json({
        success: true,
        permissionId,
        vId,
        message: "Permission ID regenerated successfully",
      });
    } catch (err: any) {
      console.error("[/callpolicy/regenerate] error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to regenerate permission ID",
        message: err?.message ?? "internal error",
        details: err?.stack,
      });
    }
  });

  // Route to get all CallPolicy permissions with their daily usage
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

      console.log(`[CallPolicy/AllPermissionsWithUsage] Getting all permissions with usage for:`, {
        policyId,
        owner,
      });

      // Fetch permissions along with their usage data
      const permissions = await getAllCallPolicyPermissionsWithUsage(policyId as `0x${string}`, owner as `0x${string}`);

      // Serialize big number fields to strings for JSON response
      const serializedPermissions = permissions.map((permission) => ({
        ...permission,
        valueLimit: permission.valueLimit.toString(),
        dailyLimit: permission.dailyLimit.toString(),
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
        message: `Found ${serializedPermissions.length} permissions with daily usage`,
      });
    } catch (err: any) {
      console.error("[/callpolicy/all-permissions-with-usage] error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to get all permissions with usage",
        message: err?.message ?? "internal error",
        details: err?.stack,
      });
    }
  });
}
