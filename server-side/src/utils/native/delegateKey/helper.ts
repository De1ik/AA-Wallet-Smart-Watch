import { Address } from "viem";
import { convertToCallPolicyPermissions, normalizeRecipients, normalizeTokenLimits } from "../dataValidation";
import { CallPolicyConfigInput, CallPolicyPermission, NormalizedCallPolicyPayload, TokenLimitInput, UnpackedUserOperationV07 } from "../types";
import { SELECTOR_NAMES } from "../constants";
import { getRootCurrentNonce, sendUserOpV07 } from "../userOps";

export function extractCallPolicyPayload(
  permissionsInput: any,
  callPolicyConfig: CallPolicyConfigInput | undefined,
  delegatedAddress: string
): NormalizedCallPolicyPayload {
  const collectedPermissions: CallPolicyPermission[] = [];
  const tokenLimitInputs: TokenLimitInput[] = [];
  const recipientsSet = new Set<string>();

  const maybeAddRecipient = (addr?: string) => {
    if (addr && typeof addr === "string") {
      recipientsSet.add(addr);
    }
  };

  // RequestCreateDelegateKey shape: { permissions: PermissionTokenEntry[] }
  if (permissionsInput?.permissions && Array.isArray(permissionsInput.permissions)) {
    for (const entry of permissionsInput.permissions) {
      const perm = entry?.permission ?? entry;
      if (!perm) continue;

      collectedPermissions.push({
        callType: Number(perm.callType) || 0,
        target: perm.target as `0x${string}`,
        delegatedKey: (perm.delegatedKey || delegatedAddress) as `0x${string}`,
        selector: (perm.selector === "0x" ? "0x00000000" : perm.selector) as `0x${string}`,
        rules: (perm.rules || []).map((rule: any) => ({
          condition: Number(rule.condition) || 0,
          offset: BigInt(rule.offset ?? 0),
          params: (rule.params || []) as `0x${string}`[],
        })),
      });

      maybeAddRecipient(perm.target);

      const tle = entry?.tokenLimitEntry;
      if (tle?.token && tle.limit) {
        tokenLimitInputs.push({
          token: tle.token,
          txLimit: tle.limit.txLimit ?? "0",
          dailyLimit: tle.limit.dailyLimit ?? "0",
          decimals: tle.limit.decimals,
          enabled: tle.limit.enabled !== false,
        });
      }
    }
  } else if (Array.isArray(permissionsInput)) {
    collectedPermissions.push(...convertToCallPolicyPermissions(permissionsInput, delegatedAddress as Address));
    permissionsInput.forEach((perm: any) => maybeAddRecipient(perm?.target));
  }

  // Merge explicit config recipients/token limits
  if (Array.isArray(callPolicyConfig?.recipients)) {
    callPolicyConfig.recipients.forEach((r) => maybeAddRecipient(r));
  }
  if (Array.isArray(callPolicyConfig?.tokenLimits)) {
    tokenLimitInputs.push(...callPolicyConfig.tokenLimits);
  }

  return {
    callPolicyPermissions: collectedPermissions,
    tokenLimits: normalizeTokenLimits(tokenLimitInputs),
    recipients: normalizeRecipients(Array.from(recipientsSet)),
  };
}

export function logCallPolicySummary(delegatedEOA: string, permissions: CallPolicyPermission[]): void {
  console.log("\n🔒 ===== CALLPOLICY RESTRICTIONS SETUP =====");
  console.log(`📱 Delegated Key: ${delegatedEOA}`);

  const uniqueTargets = getUnique(permissions.map(p => p.target));
  const uniqueSelectors = getUnique(permissions.map(p => p.selector));
  const uniqueDelegatedKeys = getUnique(permissions.map(p => p.delegatedKey));

  logSection("🎯 ALLOWED TARGET ADDRESSES:", uniqueTargets);
  logSection("👤 Delegated keys in payload:", uniqueDelegatedKeys);

  console.log("\n📘 ALLOWED FUNCTION SELECTORS:");
  uniqueSelectors.forEach((selector, i) => {
    console.log(`   ${i + 1}. ${getSelectorName(selector)} (${selector})`);
  });

  console.log("\n🔐 GENERATED PERMISSIONS:");
  permissions.forEach((perm, i) => {
    console.log(`   ${i + 1}. ${getSelectorName(perm.selector)}`);
    console.log(`      Target: ${perm.target}`);
    console.log(`      Delegated Key: ${perm.delegatedKey}`);
    console.log(`      Selector: ${perm.selector}`);
    console.log(
      `      Rules: ${perm.rules.length ? JSON.stringify(perm.rules, null, 2) : "None"}`
    );
    console.log("");
  });

  console.log("🔒 ===========================================\n");
}


export async function  executeUserOp(
  unpacked: UnpackedUserOperationV07,
  kernelAddress: Address,
): Promise<{isUpdated: boolean; txHash: string}> {
  const rootNonceBefore = await getRootCurrentNonce(kernelAddress);
  const result = await sendUserOpV07(unpacked);
  if (!result.txHash || !result.success) {
    throw new Error("Installation transaction hash not available");
  }

  const isUpdated = await checkNonceUpdated(kernelAddress, rootNonceBefore);
  return {isUpdated, txHash: result.txHash, };
}



// --- Small Internal Helpers ---
function logSection(title: string, items: string[]) {
  console.log("\n" + title);
  items.forEach((item, i) => console.log(`   ${i + 1}. ${item}`));
}

function getUnique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function getSelectorName(selector: string): string {
  return SELECTOR_NAMES[selector] ?? "Unknown";
}

async function checkNonceUpdated(kernelAddress: Address, rootNonceBefore: bigint): Promise<boolean> {
  let counter = 0;
  while (counter < 5) {
    const rootNonceAfter = await getRootCurrentNonce(kernelAddress);

    if (rootNonceAfter > rootNonceBefore) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    counter++;
  }
  return false;
}
