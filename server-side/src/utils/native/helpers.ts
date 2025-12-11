import { Address, Hex, concat, encodeAbiParameters, encodeFunctionData, getFunctionSelector, keccak256, pad, toHex } from "viem";

import { CALL_POLICY, ECDSA_SIGNER, SUDO_POLICY } from "../../shared/constants/constants";
import { kernelAbi } from "./abi";
import { publicClient } from "../../shared/clients/sepoliaClient";
import { CallPolicyPermission } from "./types";
import { checkPrefundSimple } from "../../modules/entrypoint/prefund";

export const EXECUTE_USER_OP_SELECTOR: Hex = getFunctionSelector(
  "function executeUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes) userOp, bytes32 userOpHash)"
);

export const EXEC_MODE_SIMPLE_SINGLE: Hex = ("0x" + "00" + "00" + "00000000" + "00000000" + "00".repeat(22)) as Hex;

export const SKIP_NONE: Hex = "0x0000";
export const SEL_EXECUTE: Hex = "0xe9ae5c53";
export const SEL_1271: Hex = "0x1626ba7e";

export function packAccountGasLimits(verificationGasLimit: bigint, callGasLimit: bigint): Hex {
  const hi = pad(toHex(verificationGasLimit), { size: 16 }).slice(2);
  const lo = pad(toHex(callGasLimit), { size: 16 }).slice(2);
  return ("0x" + hi + lo) as Hex;
}

export function packGasFees(maxPriorityFeePerGas: bigint, maxFeePerGas: bigint): Hex {
  const hi = pad(toHex(maxPriorityFeePerGas), { size: 16 }).slice(2);
  const lo = pad(toHex(maxFeePerGas), { size: 16 }).slice(2);
  return ("0x" + hi + lo) as Hex;
}

export function encodeSingle(target: Address, value: bigint, callData: Hex): Hex {
  const addr20 = (target.toLowerCase() as string).replace(/^0x/, "");
  const value32 = pad(toHex(value), { size: 32 }).slice(2);
  return ("0x" + addr20 + value32 + callData.slice(2)) as Hex;
}

export async function rootHookRequiresPrefix(kernelAddress: Address): Promise<boolean> {
  const vId = (await publicClient.readContract({
    address: kernelAddress,
    abi: kernelAbi,
    functionName: "rootValidator",
  })) as Hex;
  const [, hook] = (await publicClient.readContract({
    address: kernelAddress,
    abi: kernelAbi,
    functionName: "validationConfig",
    args: [vId],
  })) as readonly [number, Address];
  const addr1 = ("0x" + "0".repeat(39) + "1") as Address;
  return !(hook.toLowerCase() === addr1.toLowerCase());
}

export function buildExecuteCallData(execMode: Hex, execData: Hex, prefix: boolean): Hex {
  const inner = encodeFunctionData({ abi: kernelAbi, functionName: "execute", args: [execMode, execData] });
  return prefix ? concat([EXECUTE_USER_OP_SELECTOR, inner]) : inner;
}

export function vIdFromPermissionId(permissionId4: Hex): Hex {
  const tail20 = ("0x" + permissionId4.slice(2) + "00".repeat(16)) as Hex;
  return ("0x02" + tail20.slice(2)) as Hex;
}

export function identifierWithoutTypeFromPermissionId(permissionId4: Hex): Hex {
  return ("0x" + permissionId4.slice(2) + "00".repeat(16)) as Hex;
}

export function encodeAsNonceKey(mode: number, vType: number, id20: Hex, nonceKey: number): bigint {
  const m = BigInt(mode & 0xff) << 184n;
  const t = BigInt(vType & 0xff) << 176n;
  const id = BigInt(id20) << 16n;
  const k = BigInt(nonceKey & 0xffff);
  return m | t | id | k;
}

export function encodeAsNonce(mode: number, vType: number, id20: Hex, nonceKey: number, nonce64: bigint): bigint {
  const hi = encodeAsNonceKey(mode, vType, id20, nonceKey) << 64n;
  return hi | (nonce64 & ((1n << 64n) - 1n));
}

export function packPermissionElem(flag2bytes: Hex, moduleAddr: Address, payload: Hex = "0x"): Hex {
  const flag = flag2bytes.slice(2).padStart(4, "0");
  const mod = moduleAddr.toLowerCase().slice(2);
  const tail = payload.slice(2);
  return ("0x" + flag + mod + tail) as Hex;
}

export function buildPermissionValidationData(delegatedEOA: Address): Hex {
  const policyElem = packPermissionElem(SKIP_NONE, SUDO_POLICY, "0x");
  const signerPayload = ("0x" + delegatedEOA.toLowerCase().slice(2)) as Hex;
  const signerElem = packPermissionElem(SKIP_NONE, ECDSA_SIGNER, signerPayload);

  return encodeAbiParameters([{ type: "bytes[]" }], [[policyElem, signerElem]]) as Hex;
}

export function buildCallPolicyValidationData(
  delegatedEOA: Address,
  permissions: CallPolicyPermission[],
): Hex {
  // PolicyBase.onInstall expects data = policyId (32 bytes) ++ abi.encode(Permission[])
  const permissionsData = encodeAbiParameters(
    [
      {
        type: "tuple[]",
        components: [
          { name: "callType", type: "uint8" },
          { name: "target", type: "address" },
          { name: "delegatedKey", type: "address" },
          { name: "selector", type: "bytes4" },
          {
            name: "rules",
            type: "tuple[]",
            components: [
              { name: "condition", type: "uint8" },
              { name: "offset", type: "uint64" },
              { name: "params", type: "bytes32[]" },
            ],
          },
        ],
      },
    ],
    [
      permissions.map((p) => ({
        callType: p.callType,
        target: p.target,
        delegatedKey: p.delegatedKey,
        selector: p.selector,
        rules: p.rules.map((r) => ({
          condition: r.condition,
          offset: r.offset,
          params: r.params,
        })),
      })),
    ]
  );

  const policyElem = packPermissionElem(SKIP_NONE, CALL_POLICY, permissionsData);
  const signerPayload = ("0x" + delegatedEOA.toLowerCase().slice(2)) as Hex;
  const signerElem = packPermissionElem(SKIP_NONE, ECDSA_SIGNER, signerPayload);

  return encodeAbiParameters([{ type: "bytes[]" }], [[policyElem, signerElem]]) as Hex;
}

export function buildPermissionUserOpSig(delegatedSig65: Hex, policiesCount = 1): Hex {
  const policyPrefix = "00" + "00".repeat(8);
  return ("0x" + policyPrefix + "ff" + delegatedSig65.slice(2)) as Hex;
}

export function getPermissionId(kernel: Address, delegatedEOA: Address) {
  const permissionId = (keccak256(
    encodeAbiParameters([{ type: "address" }, { type: "address" }], [kernel, delegatedEOA])
  ) as Hex).slice(0, 10) as Hex;
  return permissionId;
}

export function getVId(permissionId: Hex) {
  const vId = vIdFromPermissionId(permissionId);
  return vId;
}

export function generateInstallationId(): string {
  return Math.random().toString(36).substring(7);
}


export async function checkPrefundSafe(kernel: Address, id: string) {
  try {
    const prefund = await checkPrefundSimple(kernel);
    if (!prefund.hasPrefund) {
      return { error: true, message: prefund.message };
    }
    return { error: false };
  } catch (err: any) {
    return { error: true, message: err.message };
  }
}





