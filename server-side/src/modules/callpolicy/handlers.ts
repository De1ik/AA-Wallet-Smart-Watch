import { Address } from "viem";

import { badRequest, internalError, ok, type ErrorResponse, type HttpResult } from "../../shared/http/apiResponse";
import {
  baseCallPolicySchema,
  permissionHashSchema,
  permissionIndexSchema,
  recipientSchema,
  tokenSchema,
  tokenUsageSchema,
} from "./schema";
import {
  decodePermissionHash,
  getAllowedRecipients,
  getAllowedTokens,
  getAllDelegatedKeys,
  getCallPolicyPermissionByIndex,
  getCallPolicyPermissionsCount,
  getCurrentDay,
  getDelegatedKeyInfo,
  getPermissionId,
  getPolicyStatus,
  getStoredPermission,
  getTokenDailyUsage,
  getTokenDailyUsageInfo,
  getTokenLimit,
  isRecipientAllowed,
} from "../../utils/native-code";

import {
  findTokenMeta,
} from "./helpers";
import { debugLog } from "../../shared/helpers/helper";

type Result<T> = Promise<HttpResult<T | ErrorResponse>>;

export async function handleCallPolicyInfo(body: unknown): Result<any> {
  try {
    const parsed = baseCallPolicySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey } = parsed.data;
    const policyId = getPermissionId(owner, delegatedKey);
    const info = await getDelegatedKeyInfo(owner, policyId, delegatedKey);

    if (!info) {
      return { status: 404, body: { success: false, error: "Policy not found" } };
    }

    debugLog("Data for response 32:", info)

    const tokensWithUsage = await Promise.all(
      info.allowedTokens.map(async (t: any) => {
        const meta = findTokenMeta(t.token);
        let usage: null | {
          used: string;
          limit: string;
          remaining: string;
          percentage: number;
        } = null;

        try {
          const usageInfo = await getTokenDailyUsageInfo(
            owner as `0x${string}`,
            policyId,
            t.token as `0x${string}`
          );
          if (usageInfo) {
            usage = {
              used: usageInfo.used.toString(),
              limit: usageInfo.limit.toString(),
              remaining: usageInfo.remaining.toString(),
              percentage: usageInfo.percentage,
            };
          }
        } catch {
          usage = null;
        }

        return {
          token: t.token,
          symbol: meta?.symbol ?? "UNKNOWN",
          name: meta?.name ?? "Unknown Token",
          decimals: meta?.decimals ?? 18,
          enabled: t.enabled,
          txLimit: t.txLimit.toString(),
          dailyLimit: t.dailyLimit.toString(),
          usage,
        };
      })
    );

    return ok({
      success: true,
      delegatedKey,
      policyId,
      data: {
        status: info.status,
        statusText: info.status === 0 ? "NA" : info.status === 1 ? "Live" : "Deprecated",
        isActive: info.isActive,
        allowedTokens: tokensWithUsage,
        allowedRecipients: info.allowedRecipients,
      },
    });
  } catch (err: any) {
    console.error("[POST /callpolicy/info] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handleCallPolicyDelegatedKeys(body: unknown): Result<any> {
  try {
    const parsed = baseCallPolicySchema.pick({ owner: true }).safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner } = parsed.data;
    const allDelegatedKeys: Address[] = await getAllDelegatedKeys(owner);

    return ok({ success: true, allDelegatedKeys });
  } catch (err: any) {
    console.error("[POST /callpolicy/delegated-keys] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handleCallPolicyStatus(body: unknown): Result<any> {
  try {
    const parsed = baseCallPolicySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey } = parsed.data;
    const policyId = getPermissionId(owner, delegatedKey);
    const status = await getPolicyStatus(owner, policyId);

    return ok({
      success: true,
      delegatedKey,
      delegatedEOA: delegatedKey,
      policyId,
      status,
      statusText: status === 0 ? "NA" : status === 1 ? "Live" : "Deprecated",
      isActive: status === 1,
    });
  } catch (err: any) {
    console.error("[POST /callpolicy/status] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handlePermissionsCount(body: unknown): Result<any> {
  try {
    const parsed = baseCallPolicySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey } = parsed.data;
    const policyId = getPermissionId(owner, delegatedKey);
    const count = await getCallPolicyPermissionsCount(policyId, owner);

    return ok({ success: true, delegatedKey, policyId, count });
  } catch (err: any) {
    console.error("[POST /callpolicy/permissions-count] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handlePermissionsAll(body: unknown): Result<any> {
  try {
    const parsed = baseCallPolicySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey } = parsed.data;
    const policyId = getPermissionId(owner, delegatedKey);
    const count = await getCallPolicyPermissionsCount(policyId, owner);
    const permissions = [];

    for (let i = 0; i < count; i++) {
      const perm = await getCallPolicyPermissionByIndex(policyId, owner, i);
      if (!perm) continue;
      const decoded = decodePermissionHash(perm.permissionHash, perm.delegatedKey);
      permissions.push({
        index: i,
        permissionHash: perm.permissionHash,
        delegatedKey: perm.delegatedKey,
        callType: decoded.callType,
        target: decoded.target,
        selector: decoded.selector,
        rules: perm.rules.map((r) => ({
          condition: r.condition,
          offset: r.offset.toString(),
          params: r.params,
        })),
      });
    }

    return ok({ success: true, delegatedKey, policyId, count: permissions.length, permissions });
  } catch (err: any) {
    console.error("[POST /callpolicy/permissions/all] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handlePermissionByIndex(body: unknown): Result<any> {
  try {
    const parsed = permissionIndexSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey, index: idx } = parsed.data;
    const policyId = getPermissionId(owner, delegatedKey);
    const perm = await getCallPolicyPermissionByIndex(policyId, owner, Number(idx));

    if (!perm) {
      return { status: 404, body: { success: false, error: "Permission not found" } };
    }
    const decoded = decodePermissionHash(perm.permissionHash, perm.delegatedKey);

    return ok({
      success: true,
      delegatedKey,
      policyId,
      index: idx,
      permission: {
        permissionHash: perm.permissionHash,
        delegatedKey: perm.delegatedKey,
        callType: decoded.callType,
        target: decoded.target,
        selector: decoded.selector,
        rules: perm.rules.map((r) => ({
          condition: r.condition,
          offset: r.offset.toString(),
          params: r.params,
        })),
      },
    });
  } catch (err: any) {
    console.error("[POST /callpolicy/permission/index] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handlePermissionByHash(body: unknown): Result<any> {
  try {
    const parsed = permissionHashSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey, permissionHash } = parsed.data;

    const policyId = getPermissionId(owner, delegatedKey );
    const perm = await getStoredPermission(owner, policyId, permissionHash);

    if (!perm || !perm.exists) {
      return { status: 404, body: { success: false, error: "Permission not found" } };
    }
    const decoded = decodePermissionHash(permissionHash, perm.delegatedKey);

    return ok({
      success: true,
      delegatedKey,
      policyId,
      permissionHash,
      permission: {
        delegatedKey: perm.delegatedKey,
        callType: decoded.callType,
        target: decoded.target,
        selector: decoded.selector,
        rules: perm.rules.map((r) => ({
          condition: r.condition,
          offset: r.offset.toString(),
          params: r.params,
        })),
      },
    });
  } catch (err: any) {
    console.error("[POST /callpolicy/permission/hash] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handleTokensAll(body: unknown): Result<any> {
  try {
    const parsed = baseCallPolicySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey } = parsed.data;
    const policyId = getPermissionId(owner, delegatedKey);
    const tokens = await getAllowedTokens(owner, policyId);

    return ok({
      success: true,
      delegatedKey,
      policyId,
      count: tokens.length,
      tokens: tokens.map((t) => ({
        token: t.token,
        enabled: t.enabled,
        txLimit: t.txLimit.toString(),
        dailyLimit: t.dailyLimit.toString(),
      })),
    });
  } catch (err: any) {
    console.error("[POST /callpolicy/tokens/all] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handleTokenLimit(body: unknown): Result<any> {
  try {
    const parsed = tokenSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey, tokenAddress } = parsed.data;
    const policyId = getPermissionId(owner, delegatedKey);
    const limit = await getTokenLimit(owner, policyId, tokenAddress);

    if (!limit) {
      return { status: 404, body: { success: false, error: "Token limit not found" } };
    }

    return ok({
      success: true,
      delegatedKey,
      policyId,
      tokenAddress,
      enabled: limit.enabled,
      txLimit: limit.txLimit.toString(),
      dailyLimit: limit.dailyLimit.toString(),
    });
  } catch (err: any) {
    console.error("[POST /callpolicy/token-limit] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handleTokenUsage(body: unknown): Result<any> {
  try {
    const parsed = tokenUsageSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey, tokenAddress, day } = parsed.data;
    const policyId = getPermissionId(owner, delegatedKey);
    const usage = await getTokenDailyUsage(owner, policyId, tokenAddress, day ?? undefined);

    return ok({
      success: true,
      delegatedKey,
      policyId,
      tokenAddress,
      day: day ?? getCurrentDay(),
      usage: usage.toString(),
    });
  } catch (err: any) {
    console.error("[POST /callpolicy/token/usage] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handleTokenUsageInfo(body: unknown): Result<any> {
  try {
    const parsed = tokenSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey, tokenAddress } = parsed.data;
    const policyId = getPermissionId(owner, delegatedKey);
    const usageInfo = await getTokenDailyUsageInfo(owner, policyId, tokenAddress);

    if (!usageInfo) {
      return { status: 404, body: { success: false, error: "Token not found or not configured" } };
    }

    return ok({
      success: true,
      delegatedKey,
      policyId,
      tokenAddress,
      day: getCurrentDay(),
      used: usageInfo.used.toString(),
      limit: usageInfo.limit.toString(),
      remaining: usageInfo.remaining.toString(),
      percentage: usageInfo.percentage,
    });
  } catch (err: any) {
    console.error("[POST /callpolicy/token/usage-info] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handleRecipientsAll(body: unknown): Result<any> {
  try {
    const parsed = baseCallPolicySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey } = parsed.data;
    const policyId = getPermissionId(owner, delegatedKey);
    const recipients = await getAllowedRecipients(owner, policyId);

    return ok({
      success: true,
      delegatedKey,
      policyId,
      count: recipients.length,
      recipients,
    });
  } catch (err: any) {
    console.error("[POST /callpolicy/recipient/all] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}

export async function handleRecipientIsAllowed(body: unknown): Result<any> {
  try {
    const parsed = recipientSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { owner, delegatedKey, recipientAddress } = parsed.data;
    const policyId = getPermissionId(owner, delegatedKey);
    const allowed = await isRecipientAllowed(owner, policyId, recipientAddress);

    return ok({
      success: true,
      delegatedKey,
      policyId,
      recipientAddress,
      allowed,
    });
  } catch (err: any) {
    console.error("[POST /callpolicy/recipient/is-allowed] error:", err);
    return internalError(err?.message ?? "internal error", err);
  }
}
