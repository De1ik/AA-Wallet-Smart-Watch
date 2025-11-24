import { Address, Hex, encodeAbiParameters, encodePacked, keccak256 } from "viem";

import { CALL_POLICY } from "./constants";
import { callPolicyAbi } from "./abi";
import { publicClient } from "./clients";
import { CallPolicyParamRule, CallPolicyPermission } from "./types";

// ---------------- UTILITY FUNCTIONS ----------------

function padPolicyId(policyId: Hex): Hex {
  return padEnd(policyId, 32);
}

function padEnd(value: Hex, size: number): Hex {
  const hexBody = value.replace(/^0x/, "");
  const padded = hexBody.padEnd(size * 2, "0");
  return ("0x" + padded) as Hex;
}

export function getCurrentDay(): number {
  return Math.floor(Date.now() / 1000 / 86400);
}

// ---------------- CORE READ FUNCTIONS ----------------

/**
 * Get delegated key address for specific policy ID
 */
export async function getAllDelegatedKeys(wallet: Address): Promise<Address[]> {
  try {

    const delegatedKey = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "delegatedKeysList",
      args: [wallet],
    })) as Address[];

    return delegatedKey;
  } catch (error) {
    console.error("[CallPolicy] Error getting delegated key:", error);
    return [] as Address[];
  }
}

/**
 * Get policy status (NA = 0, Live = 1, Deprecated = 2)
 */
export async function getPolicyStatus(wallet: Address, policyId: Hex): Promise<number> {
  try {
    const policyId32 = padPolicyId(policyId);

    const status = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "status",
      args: [wallet, policyId32],
    })) as number;

    return status;
  } catch (error) {
    console.error("[CallPolicy] Error getting policy status:", error);
    return 0; // NA
  }
}

/**
 * Get permissions count by reading array length
 */
export async function getCallPolicyPermissionsCount(policyId: Hex, wallet: Address): Promise<number> {
  try {
    const policyId32 = padPolicyId(policyId);
    let count = 0;

    // Try to read array elements until we get an error
    while (true) {
      try {
        await publicClient.readContract({
          address: CALL_POLICY,
          abi: callPolicyAbi,
          functionName: "permissionHashes",
          args: [wallet, policyId32, BigInt(count)],
        });
        count++;
      } catch {
        break;
      }
    }

    return count;
  } catch (error) {
    console.error("[CallPolicy] Error getting permissions count:", error);
    return 0;
  }
}

/**
 * Get permission hash by index
 */
export async function getPermissionHashByIndex(
  wallet: Address,
  policyId: Hex,
  index: number
): Promise<Hex | null> {
  try {
    const policyId32 = padPolicyId(policyId);

    const hash = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "permissionHashes",
      args: [wallet, policyId32, BigInt(index)],
    })) as Hex;

    return hash;
  } catch (error) {
    console.error("[CallPolicy] Error getting permission hash by index:", error);
    return null;
  }
}

/**
 * Get stored permission by hash
 */
export async function getStoredPermission(
  wallet: Address,
  policyId: Hex,
  permissionHash: Hex
): Promise<{
  delegatedKey: Address;
  rules: CallPolicyParamRule[];
  exists: boolean;
} | null> {
  try {
    const policyId32 = padPolicyId(policyId);

    const result = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "storedPermissions",
      args: [wallet, policyId32, permissionHash],
    })) as {
      rules: any[];
      delegatedKey: Address;
      exists: boolean;
    };

    return {
      delegatedKey: result.delegatedKey,
      exists: result.exists,
      rules: result.rules.map((rule: any) => ({
        condition: Number(rule.condition),
        offset: BigInt(rule.offset ?? 0),
        params: rule.params,
      })),
    };
  } catch (error) {
    console.error("[CallPolicy] Error getting stored permission:", error);
    return null;
  }
}

/**
 * Get permission by index (combined hash + stored permission)
 */
export async function getCallPolicyPermissionByIndex(
  policyId: Hex,
  wallet: Address,
  index: number
): Promise<{
  permissionHash: Hex;
  delegatedKey: Address;
  rules: CallPolicyParamRule[];
} | null> {
  try {
    const hash = await getPermissionHashByIndex(wallet, policyId, index);
    if (!hash) return null;

    const permission = await getStoredPermission(wallet, policyId, hash);
    if (!permission || !permission.exists) return null;

    return {
      permissionHash: hash,
      delegatedKey: permission.delegatedKey,
      rules: permission.rules,
    };
  } catch (error) {
    console.error("[CallPolicy] Error getting permission by index:", error);
    return null;
  }
}

// ---------------- TOKEN LIMITS ----------------

/**
 * Get allowed tokens count
 */
export async function getAllowedTokensCount(wallet: Address, policyId: Hex): Promise<number> {
  try {
    const policyId32 = padPolicyId(policyId);
    let count = 0;

    while (true) {
      try {
        await publicClient.readContract({
          address: CALL_POLICY,
          abi: callPolicyAbi,
          functionName: "allowedTokens",
          args: [wallet, policyId32, BigInt(count)],
        });
        count++;
      } catch {
        break;
      }
    }

    return count;
  } catch (error) {
    console.error("[CallPolicy] Error getting allowed tokens count:", error);
    return 0;
  }
}

/**
 * Get token address by index
 */
export async function getTokenByIndex(wallet: Address, policyId: Hex, index: number): Promise<Address | null> {
  try {
    const policyId32 = padPolicyId(policyId);

    const token = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "allowedTokens",
      args: [wallet, policyId32, BigInt(index)],
    })) as Address;

    return token;
  } catch (error) {
    console.error("[CallPolicy] Error getting token by index:", error);
    return null;
  }
}

/**
 * Get token limits
 */
export async function getTokenLimit(
  wallet: Address,
  policyId: Hex,
  token: Address
): Promise<{
  enabled: boolean;
  txLimit: bigint;
  dailyLimit: bigint;
} | null> {
  try {
    const policyId32 = padPolicyId(policyId);

    const limit = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "tokenLimits",
      args: [wallet, policyId32, token],
    })) as {
      enabled: boolean;
      txLimit: bigint;
      dailyLimit: bigint;
    };

    return limit;
  } catch (error) {
    console.error("[CallPolicy] Error getting token limit:", error);
    return null;
  }
}

/**
 * Get all allowed tokens with their limits
 */
export async function getAllowedTokens(
  wallet: Address,
  policyId: Hex
): Promise<Array<{ token: Address; enabled: boolean; txLimit: bigint; dailyLimit: bigint }>> {
  try {
    const count = await getAllowedTokensCount(wallet, policyId);
    const tokens: Array<{ token: Address; enabled: boolean; txLimit: bigint; dailyLimit: bigint }> = [];

    for (let i = 0; i < count; i++) {
      const token = await getTokenByIndex(wallet, policyId, i);
      if (!token) continue;

      const limit = await getTokenLimit(wallet, policyId, token);
      if (!limit) continue;

      tokens.push({
        token,
        enabled: limit.enabled,
        txLimit: limit.txLimit,
        dailyLimit: limit.dailyLimit,
      });
    }

    return tokens;
  } catch (error) {
    console.error("[CallPolicy] Error getting allowed tokens:", error);
    return [];
  }
}

/**
 * Get token daily usage
 */
export async function getTokenDailyUsage(
  wallet: Address,
  policyId: Hex,
  token: Address,
  day?: number
): Promise<bigint> {
  try {
    const policyId32 = padPolicyId(policyId);
    const targetDay = day ?? getCurrentDay();

    const usage = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "tokenDailyUsed",
      args: [wallet, policyId32, token, BigInt(targetDay)],
    })) as bigint;

    return usage;
  } catch (error) {
    console.error("[CallPolicy] Error getting token daily usage:", error);
    return 0n;
  }
}

/**
 * Get token daily usage with limit info
 */
export async function getTokenDailyUsageInfo(
  wallet: Address,
  policyId: Hex,
  token: Address
): Promise<{
  used: bigint;
  limit: bigint;
  remaining: bigint;
  percentage: number;
} | null> {
  try {
    const limit = await getTokenLimit(wallet, policyId, token);
    if (!limit) return null;

    const used = await getTokenDailyUsage(wallet, policyId, token);
    const remaining = limit.dailyLimit > used ? limit.dailyLimit - used : 0n;
    const percentage = limit.dailyLimit > 0n ? Number((used * 10000n) / limit.dailyLimit) / 100 : 0;

    return {
      used,
      limit: limit.dailyLimit,
      remaining,
      percentage,
    };
  } catch (error) {
    console.error("[CallPolicy] Error getting token daily usage info:", error);
    return null;
  }
}

// ---------------- RECIPIENTS ----------------

/**
 * Get allowed recipients count
 */
export async function getAllowedRecipientsCount(wallet: Address, policyId: Hex): Promise<number> {
  try {
    const policyId32 = padPolicyId(policyId);
    let count = 0;

    while (true) {
      try {
        await publicClient.readContract({
          address: CALL_POLICY,
          abi: callPolicyAbi,
          functionName: "recipientList",
          args: [wallet, policyId32, BigInt(count)],
        });
        count++;
      } catch {
        break;
      }
    }

    return count;
  } catch (error) {
    console.error("[CallPolicy] Error getting recipients count:", error);
    return 0;
  }
}

/**
 * Get recipient by index
 */
export async function getRecipientByIndex(wallet: Address, policyId: Hex, index: number): Promise<Address | null> {
  try {
    const policyId32 = padPolicyId(policyId);

    const recipient = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "recipientList",
      args: [wallet, policyId32, BigInt(index)],
    })) as Address;

    return recipient;
  } catch (error) {
    console.error("[CallPolicy] Error getting recipient by index:", error);
    return null;
  }
}

/**
 * Check if recipient is allowed
 */
export async function isRecipientAllowed(wallet: Address, policyId: Hex, recipient: Address): Promise<boolean> {
  try {
    const policyId32 = padPolicyId(policyId);

    const allowed = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "recipientAllowed",
      args: [wallet, policyId32, recipient],
    })) as boolean;

    return allowed;
  } catch (error) {
    console.error("[CallPolicy] Error checking recipient:", error);
    return false;
  }
}

/**
 * Get all allowed recipients
 */
export async function getAllowedRecipients(wallet: Address, policyId: Hex): Promise<Address[]> {
  try {
    const count = await getAllowedRecipientsCount(wallet, policyId);
    const recipients: Address[] = [];

    for (let i = 0; i < count; i++) {
      const recipient = await getRecipientByIndex(wallet, policyId, i);
      if (recipient) {
        recipients.push(recipient);
      }
    }

    return recipients;
  } catch (error) {
    console.error("[CallPolicy] Error getting allowed recipients:", error);
    return [];
  }
}

// ---------------- COMPLETE INFO ----------------

/**
 * Get complete delegated key information
 */
export async function getDelegatedKeyInfo(wallet: Address, policyId: Hex, delegatedKey: Address) {
  try {
    const [status, tokens, recipients] = await Promise.all([
      getPolicyStatus(wallet, policyId),
      getAllowedTokens(wallet, policyId),
      getAllowedRecipients(wallet, policyId),
    ]);

    return {
      delegatedKey,
      status, // 0 = NA, 1 = Live, 2 = Deprecated
      isActive: status === 1,
      allowedTokens: tokens,
      allowedRecipients: recipients,
    };
  } catch (error) {
    console.error("[CallPolicy] Error getting delegated key info:", error);
    return null;
  }
}

// ---------------- LEGACY COMPATIBILITY ----------------

/**
 * Fetch all permissions (legacy compatible)
 */
export async function fetchCallPolicyPermissions(
  kernelAddress: Address,
  delegatedEOA: Address,
  permissionId: Hex
): Promise<CallPolicyPermission[]> {
  try {
    const permissions: CallPolicyPermission[] = [];
    const permissionsCount = await getCallPolicyPermissionsCount(permissionId, kernelAddress);

    for (let i = 0; i < permissionsCount; i++) {
      try {
        const permissionData = await getCallPolicyPermissionByIndex(permissionId, kernelAddress, i);

        if (permissionData) {
          // Decode permission hash to extract callType, target, selector
          // Note: This is a simplified version - you may need to adjust based on your hash structure
          const { callType, target, selector } = decodePermissionHash(
            permissionData.permissionHash,
            permissionData.delegatedKey
          );

          permissions.push({
            callType,
            target,
            delegatedKey: permissionData.delegatedKey,
            selector,
            rules: permissionData.rules,
          });
        }
      } catch (error) {
        console.warn(`[CallPolicy] Error fetching permission ${i}:`, error);
        continue;
      }
    }

    return permissions;
  } catch (error) {
    console.error("[CallPolicy] Error fetching permissions:", error);
    throw error;
  }
}

/**
 * Check if permission exists
 */
export async function checkPermissionExists(
  kernelAddress: Address,
  delegatedEOA: Address,
  permissionId: Hex,
  callType: number,
  target: Address,
  selector: Hex
): Promise<boolean> {
  try {
    const policyId32 = padPolicyId(permissionId);
    const permissionHash = keccak256(
      encodePacked(
        ["uint8", "address", "bytes4", "address"],
        [callType, target, selector, delegatedEOA]
      )
    );

    const permission = await getStoredPermission(kernelAddress, permissionId, permissionHash);
    return permission?.exists ?? false;
  } catch (error) {
    console.error("[CallPolicy] Error checking permission:", error);
    return false;
  }
}

/**
 * Get all permissions with daily usage
 */
export async function getAllCallPolicyPermissionsWithUsage(
  policyId: Hex,
  owner: Address
): Promise<
  Array<{
    index: number;
    permissionHash: Hex;
    delegatedKey: Address;
    callType: number;
    target: Address;
    selector: Hex;
    rules: CallPolicyParamRule[];
    dailyUsage: bigint;
  }>
> {
  try {
    const permissionsCount = await getCallPolicyPermissionsCount(policyId, owner);
    const permissions = [];

    for (let i = 0; i < permissionsCount; i++) {
      const permissionData = await getCallPolicyPermissionByIndex(policyId, owner, i);

      if (permissionData) {
        // Note: dailyUsage is now stored per token, not per permission
        // This is for non-asset operations
        const { callType, target, selector } = decodePermissionHash(
          permissionData.permissionHash,
          permissionData.delegatedKey
        );

        permissions.push({
          index: i,
          permissionHash: permissionData.permissionHash,
          delegatedKey: permissionData.delegatedKey,
          callType,
          target,
          selector,
          rules: permissionData.rules,
          dailyUsage: 0n, // Not tracked per permission anymore for asset transfers
        });
      }
    }

    return permissions;
  } catch (error) {
    console.error("[CallPolicy] Error getting all permissions with usage:", error);
    return [];
  }
}

// ---------------- HELPER FUNCTIONS ----------------

/**
 * Decode permission hash to extract callType, target, selector
 * Note: This is approximate - the actual values were hashed together
 */
export function decodePermissionHash(
  permissionHash: Hex,
  delegatedKey: Address
): {
  callType: number;
  target: Address;
  selector: Hex;
} {
  // Since hash is one-way, we can only make educated guesses
  // You may need to store these separately or try common patterns
  
  // Try common patterns
  const patterns = [
    // ETH transfer (callType=0, target=any, selector=0x00000000)
    {
      hash: keccak256(
        encodePacked(
          ["uint8", "address", "bytes4", "address"],
          [0, "0x0000000000000000000000000000000000000000", "0x00000000", delegatedKey]
        )
      ),
      callType: 0,
      target: "0x0000000000000000000000000000000000000000" as Address,
      selector: "0x00000000" as Hex,
    },
    // ERC20 transfer (callType=0, target=any, selector=0xa9059cbb)
    {
      hash: keccak256(
        encodePacked(
          ["uint8", "address", "bytes4", "address"],
          [0, "0x0000000000000000000000000000000000000000", "0xa9059cbb", delegatedKey]
        )
      ),
      callType: 0,
      target: "0x0000000000000000000000000000000000000000" as Address,
      selector: "0xa9059cbb" as Hex,
    },
  ];

  for (const pattern of patterns) {
    if (pattern.hash === permissionHash) {
      return {
        callType: pattern.callType,
        target: pattern.target,
        selector: pattern.selector,
      };
    }
  }

  // Default fallback
  return {
    callType: 0,
    target: "0x0000000000000000000000000000000000000000" as Address,
    selector: "0x00000000" as Hex,
  };
}

/**
 * Get installed call policies (legacy)
 */
export async function getInstalledCallPolicies(kernelAddress: Address): Promise<Hex[]> {
  try {
    return [CALL_POLICY];
  } catch (error) {
    console.error("[CallPolicy] Error getting installed policies:", error);
    return [];
  }
}
