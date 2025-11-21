import { Address, Hex, encodeAbiParameters, encodePacked, keccak256 } from "viem";

import { CALL_POLICY } from "./constants";
import { callPolicyAbi } from "./abi";
import { publicClient } from "./clients";
import { CallPolicyParamRule, CallPolicyPermission } from "./types";

export async function getCallPolicyPermissionsCount(policyId: Hex, owner: Address): Promise<number> {
  try {
    const policyId32 = (policyId + "00000000000000000000000000000000000000000000000000000000") as Hex;

    const count = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "getPermissionsCount",
      args: [policyId32, owner],
    })) as bigint;

    return Number(count);
  } catch (error) {
    console.error("[CallPolicy v2] Error getting permissions count:", error);
    return 0;
  }
}

export async function getCallPolicyPermissionByIndex(
  policyId: Hex,
  owner: Address,
  index: number
): Promise<{
  permissionHash: Hex;
  valueLimit: bigint;
  dailyLimit: bigint;
  rules: CallPolicyParamRule[];
} | null> {
  try {
    const policyId32 = (policyId + "00000000000000000000000000000000000000000000000000000000") as Hex;

    const result = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "getPermissionByIndex",
      args: [policyId32, owner, BigInt(index)],
    })) as [Hex, bigint, bigint, any[]];

    const [permissionHash, valueLimit, dailyLimit, rules] = result;

    return {
      permissionHash,
      valueLimit,
      dailyLimit,
      rules: rules.map((rule: any) => ({
        condition: Number(rule.condition),
        offset: rule.offset,
        params: rule.params,
      })),
    };
  } catch (error) {
    console.error("[CallPolicy v2] Error getting permission by index:", error);
    return null;
  }
}

export async function fetchCallPolicyPermissions(
  kernelAddress: Address,
  _delegatedEOA: Address,
  permissionId: Hex
): Promise<CallPolicyPermission[]> {
  try {
    const permissions: CallPolicyPermission[] = [];
    const permissionsCount = await getCallPolicyPermissionsCount(permissionId, kernelAddress);

    for (let i = 0; i < permissionsCount; i++) {
      try {
        const permissionData = await getCallPolicyPermissionByIndex(permissionId, kernelAddress, i);

        if (permissionData) {
          let decodedCallType = 0;
          let decodedTarget = "0x0000000000000000000000000000000000000000" as `0x${string}`;
          let decodedSelector = "0x00000000" as `0x${string}`;

          const targetAddress = "0xe069d36Fe1f7B41c7B8D4d453d99D4D86d620c15";

          const ethTransferHash = keccak256(
            encodePacked(["uint8", "address", "bytes4"], [0, targetAddress, "0x00000000"])
          );

          const erc20TransferHash = keccak256(
            encodePacked(["uint8", "address", "bytes4"], [0, targetAddress, "0xa9059cbb"])
          );

          if (permissionData.permissionHash === ethTransferHash) {
            decodedCallType = 0;
            decodedTarget = targetAddress as `0x${string}`;
            decodedSelector = "0x00000000" as `0x${string}`;
          } else if (permissionData.permissionHash === erc20TransferHash) {
            decodedCallType = 0;
            decodedTarget = targetAddress as `0x${string}`;
            decodedSelector = "0xa9059cbb" as `0x${string}`;
          } else {
            const anyTargetHash = keccak256(
              encodePacked(
                ["uint8", "address", "bytes4"],
                [0, "0x0000000000000000000000000000000000000000", "0x00000000"]
              )
            );

            if (permissionData.permissionHash === anyTargetHash) {
              decodedCallType = 0;
              decodedTarget = "0x0000000000000000000000000000000000000000" as `0x${string}`;
              decodedSelector = "0x00000000" as `0x${string}`;
            }
          }

          permissions.push({
            callType: decodedCallType,
            target: decodedTarget,
            selector: decodedSelector,
            valueLimit: permissionData.valueLimit,
            dailyLimit: permissionData.dailyLimit,
            rules: permissionData.rules,
          });
        }
      } catch (error) {
        console.warn(`[CallPolicy v2] Error fetching permission ${i}:`, error);
        continue;
      }
    }

    return permissions;
  } catch (error) {
    console.error("[CallPolicy v2] Error fetching permissions:", error);
    throw error;
  }
}

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

    const permissionData = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "getPermission",
      args: [
        policyId32,
        keccak256(encodeAbiParameters([{ type: "uint8" }, { type: "address" }, { type: "bytes4" }], [callType, target, selector])),
        kernelAddress,
      ],
    })) as [bigint, bigint, any[]];

    return permissionData && permissionData.length > 0;
  } catch (error) {
    console.error("[CallPolicy v2] Error checking permission:", error);
    return false;
  }
}

export async function getInstalledCallPolicies(kernelAddress: Address): Promise<Hex[]> {
  try {
    return [CALL_POLICY];
  } catch (error) {
    console.error("[CallPolicy] Error getting installed policies:", error);
    return [];
  }
}

export async function getCallPolicyDailyUsage(policyId: Hex, wallet: Address, permissionHash: Hex, day: number): Promise<bigint> {
  try {
    const policyId32 = padPolicyId(policyId);

    const usage = (await publicClient.readContract({
      address: CALL_POLICY,
      abi: callPolicyAbi,
      functionName: "dailyUsed",
      args: [policyId32, wallet, permissionHash, BigInt(day)],
    })) as bigint;

    return usage;
  } catch (error) {
    console.error("[CallPolicy v2] Error getting daily usage:", error);
    return 0n;
  }
}

export function getCurrentDay(): number {
  return Math.floor(Date.now() / 1000 / 86400);
}

export async function getCallPolicyDailyUsageToday(policyId: Hex, wallet: Address, permissionHash: Hex): Promise<bigint> {
  const today = getCurrentDay();
  return getCallPolicyDailyUsage(policyId, wallet, permissionHash, today);
}

export async function getAllCallPolicyPermissionsWithUsage(
  policyId: Hex,
  owner: Address
): Promise<
  Array<{
    index: number;
    permissionHash: Hex;
    callType: number;
    target: `0x${string}`;
    selector: `0x${string}`;
    valueLimit: bigint;
    dailyLimit: bigint;
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
        const dailyUsage = await getCallPolicyDailyUsageToday(policyId, owner, permissionData.permissionHash);
        const targetAddress = "0xe069d36Fe1f7B41c7B8D4d453d99D4D86d620c15";

        const ethTransferHash = keccak256(
          encodePacked(["uint8", "address", "bytes4"], [0, targetAddress, "0x00000000"])
        );

        const erc20TransferHash = keccak256(
          encodePacked(["uint8", "address", "bytes4"], [0, targetAddress, "0xa9059cbb"])
        );

        let decodedCallType = 0;
        let decodedTarget = "0x0000000000000000000000000000000000000000" as `0x${string}`;
        let decodedSelector = "0x00000000" as `0x${string}`;

        if (permissionData.permissionHash === ethTransferHash) {
          decodedCallType = 0;
          decodedTarget = targetAddress as `0x${string}`;
          decodedSelector = "0x00000000" as `0x${string}`;
        } else if (permissionData.permissionHash === erc20TransferHash) {
          decodedCallType = 0;
          decodedTarget = targetAddress as `0x${string}`;
          decodedSelector = "0xa9059cbb" as `0x${string}`;
        } else {
          const anyTargetHash = keccak256(
            encodePacked(
              ["uint8", "address", "bytes4"],
              [0, "0x0000000000000000000000000000000000000000", "0x00000000"]
            )
          );

          if (permissionData.permissionHash === anyTargetHash) {
            decodedCallType = 0;
            decodedTarget = "0x0000000000000000000000000000000000000000" as `0x${string}`;
            decodedSelector = "0x00000000" as `0x${string}`;
          }
        }

        permissions.push({
          index: i,
          permissionHash: permissionData.permissionHash,
          callType: decodedCallType,
          target: decodedTarget,
          selector: decodedSelector,
          valueLimit: permissionData.valueLimit,
          dailyLimit: permissionData.dailyLimit,
          rules: permissionData.rules,
          dailyUsage,
        });
      }
    }

    return permissions;
  } catch (error) {
    console.error("[CallPolicy v2] Error getting all permissions with usage:", error);
    return [];
  }
}

function padPolicyId(policyId: Hex): Hex {
  return padEnd(policyId, 32);
}

function padEnd(value: Hex, size: number): Hex {
  const hexBody = value.replace(/^0x/, "");
  const padded = hexBody.padEnd(size * 2, "0");
  return ("0x" + padded) as Hex;
}
