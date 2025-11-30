import { Address, parseUnits } from "viem";
import { CallPolicyConfigInput, CallPolicyPermission, NormalizedTokenLimit, PermissionPolicyType, PermissionRule, TokenLimitInput } from "./types";
import { KNOWN_TOKEN_DECIMALS } from "./constants";

export function validateAddress(addr: string): string | null {
  if (!addr) return "Address is required";
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return "Invalid address format";
  return null;
}

export function validateKeyType(type: PermissionPolicyType): string | null {
  if (!type || ![PermissionPolicyType.SUDO, PermissionPolicyType.CALL_POLICY].includes(type)) {
    return `keyType must be either '${PermissionPolicyType.SUDO}' or '${PermissionPolicyType.CALL_POLICY}'`;
  }
  return null;
}

export function validateCallPolicyPermissions(
  permissions: CallPolicyPermission[] | { permissions: any[] }
): string | null {
  // Normalize two possible input formats
  const entries = Array.isArray((permissions as any).permissions)
    ? (permissions as any).permissions.map((p: any) => p?.permission ?? p)
    : permissions;

  if (!Array.isArray(entries)) {
    return "permissions must be an array";
  }

  for (let i = 0; i < entries.length; i++) {
    const perm = entries[i];
    if (!perm) return `permissions[${i}] is required`;

    if (typeof perm.callType !== "number") {
      return `permissions[${i}].callType is required and must be a number`;
    }

    if (typeof perm.target !== "string") {
      return `permissions[${i}].target is required and must be a valid Ethereum address`;
    }

    if (typeof perm.selector !== "string") {
      return `permissions[${i}].selector is required and must be a 4-byte hex string`;
    }

    if (perm.delegatedKey && typeof perm.delegatedKey !== "string") {
      return `permissions[${i}].delegatedKey must be a valid Ethereum address if provided`;
    }
  }

  return null;
}

export function validateCallPolicyConfig(config?: CallPolicyConfigInput): string | null {
  if (!config) {
    return "callPolicyConfig is required for callpolicy keyType";
  }
  if (!Array.isArray(config.tokenLimits) || config.tokenLimits.length === 0) {
    return "callPolicyConfig.tokenLimits must be a non-empty array";
  }
  if (!Array.isArray(config.recipients) || config.recipients.length === 0) {
    return "callPolicyConfig.recipients must be a non-empty array of addresses";
  }

  for (let i = 0; i < config.tokenLimits.length; i++) {
    const limit = config.tokenLimits[i];
    if (!limit?.token || typeof limit.token !== "string") {
      return `tokenLimits[${i}].token is required`;
    }
    if (limit.txLimit === undefined || limit.txLimit === null) {
      return `tokenLimits[${i}].txLimit is required`;
    }
    if (limit.dailyLimit === undefined || limit.dailyLimit === null) {
      return `tokenLimits[${i}].dailyLimit is required`;
    }
  }

  return null;
}


// Helper to convert input permissions to CallPolicyPermission format
export function convertToCallPolicyPermissions(
  permissions: any[],
  delegatedAddress: Address
): CallPolicyPermission[] {

  return permissions.map((perm): CallPolicyPermission => {
    const selector =
      perm.selector === "0x" ? "0x00000000" : (perm.selector as `0x${string}`);

    return {
      callType: Number(perm.callType) || 0,
      target: perm.target as `0x${string}`,
      delegatedKey: (perm.delegatedKey || delegatedAddress) as `0x${string}`,
      selector,
      rules: (perm.rules || []).map((rule: any): PermissionRule => ({
        condition: Number(rule.condition) || 0,
        offset: BigInt(rule.offset ?? 0),
        params: (rule.params || []) as `0x${string}`[],
      })),
    };
  });
}

export function normalizeTokenLimits(limits?: TokenLimitInput[]): NormalizedTokenLimit[] {
  if (!Array.isArray(limits)) return [];
  const seen = new Set<string>();
  const result: NormalizedTokenLimit[] = [];

  for (const limit of limits) {
    if (!limit?.token || typeof limit.token !== "string") continue;
    const lower = limit.token.toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(lower)) continue;
    if (seen.has(lower)) continue;

    const decimals =
      typeof limit.decimals === "number"
        ? limit.decimals
        : KNOWN_TOKEN_DECIMALS[lower] ?? 18;
    try {
      const txLimit = parseUnits(limit.txLimit?.toString() ?? "0", decimals);
      const dailyLimit = parseUnits(limit.dailyLimit?.toString() ?? "0", decimals);
      result.push({
        token: lower as Address,
        txLimit,
        dailyLimit,
        enabled: limit.enabled !== false,
      });
      seen.add(lower);
    } catch (error) {
      console.warn("[CallPolicy] Failed to normalize token limit", limit, error);
      continue;
    }
  }

  return result;
}

export function normalizeRecipients(recipients?: string[]): Address[] {
  if (!Array.isArray(recipients)) return [];
  const seen = new Set<string>();
  const result: Address[] = [];

  for (const recipient of recipients) {
    if (!recipient || typeof recipient !== "string") continue;
    const lower = recipient.toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(lower)) continue;
    if (seen.has(lower)) continue;

    seen.add(lower);
    result.push(lower as Address);
  }

  return result;
}