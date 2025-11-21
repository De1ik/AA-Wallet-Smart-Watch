import {
  Address,
  Hex,
  concat,
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  pad,
  parseAbi,
  parseAbiParameters,
  toHex,
} from "viem";

import {
  CALL_POLICY,
  ENTRY_POINT,
  HOOK_SENTINEL,
  KERNEL,
  delegated,
  root,
} from "./constants";

import {
  buildCallPolicyValidationData,
  buildExecuteCallData,
  buildPermissionUserOpSig,
  buildPermissionValidationData,
  encodeAsNonce,
  encodeAsNonceKey,
  encodeSingle,
  identifierWithoutTypeFromPermissionId,
  packAccountGasLimits,
  packGasFees,
  rootHookRequiresPrefix,
  vIdFromPermissionId,
  EXEC_MODE_SIMPLE_SINGLE,
} from "./helpers";
import { bundlerClient, publicClient } from "./clients";
import { callPolicyAbi, entryPointAbi, kernelAbi, kernelAbiGrant, kernelInstallValidationsAbi, stakeAbi } from "./abi";
import { getCurrentGasPrices, getOptimizedGasLimits } from "./gas";
import { CallPolicyPermission, PackedUserOperation, UnpackedUserOperationV07 } from "./types";

export interface SendUserOpResult {
  txHash: Hex;
  userOpHash: Hex;
  success: boolean;
  gasUsed?: string;
  revertReason?: string;
}

export class UserOpExecutionError extends Error {
  result: SendUserOpResult;
  constructor(message: string, result: SendUserOpResult) {
    super(message);
    this.name = "UserOpExecutionError";
    this.result = result;
  }
}

function normalizeStatus(receipt: any): boolean | undefined {
  if (typeof receipt?.success === "boolean") {
    return receipt.success;
  }
  const status = receipt?.receipt?.status ?? receipt?.status;
  if (typeof status === "string") {
    return status === "0x1" || status === "1";
  }
  if (typeof status === "number") {
    return status === 1;
  }
  return undefined;
}

function extractRevertReason(receipt: any): string | undefined {
  return receipt?.reason ?? receipt?.returnInfo?.revertReason ?? receipt?.returnInfo?.error ?? receipt?.paymasterInfo?.context;
}

export async function sendUserOpV07(unpacked: UnpackedUserOperationV07, maxWaitTime: number = 45_000): Promise<SendUserOpResult> {
  const userOpHash = (await (bundlerClient as any).request({
    method: "eth_sendUserOperation",
    params: [unpacked, ENTRY_POINT],
  })) as Hex;

  const startTime = Date.now();
  const pollInterval = 1500;

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const receipt = (await (bundlerClient as any).request({
        method: "eth_getUserOperationReceipt",
        params: [userOpHash],
      })) as any;

      if (!receipt) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      const actualTxHash = (receipt.receipt?.transactionHash ?? receipt.transactionHash ?? userOpHash) as Hex;
      const gasUsedRaw = receipt.actualGasUsed ?? receipt.receipt?.gasUsed;
      const gasUsed = typeof gasUsedRaw === "string" ? gasUsedRaw : gasUsedRaw?.toString();
      const success = normalizeStatus(receipt);
      const revertReason = success ? undefined : extractRevertReason(receipt);

      const result: SendUserOpResult = {
        txHash: actualTxHash,
        userOpHash,
        success: success ?? true,
        gasUsed,
        revertReason,
      };

      if (success === false) {
        throw new UserOpExecutionError(revertReason ?? "User operation failed", result);
      }

      return result;
    } catch (err) {
      if (err instanceof UserOpExecutionError) {
        throw err;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  const timeoutResult: SendUserOpResult = {
    txHash: userOpHash,
    userOpHash,
    success: false,
    revertReason: "Timeout waiting for user operation receipt",
  };
  throw new UserOpExecutionError("Timed out waiting for user operation receipt", timeoutResult);
}

export async function buildDepositUserOp(depositAmount: bigint, _nonceKey = 0) {
  const depositCalldata = encodeFunctionData({
    abi: stakeAbi,
    functionName: "depositTo",
    args: [KERNEL],
  });
  const execData = encodeSingle(ENTRY_POINT, depositAmount, depositCalldata);
  const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix());

  const { maxFeePerGas, maxPriorityFeePerGas } = await getCurrentGasPrices();
  const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits("install");

  const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
  const gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas);

  const key192 = ("0x" + "00".repeat(24)) as Hex;
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [KERNEL, BigInt(key192)],
  })) as bigint;
  const nonceFull = nonce64;

  const packed: PackedUserOperation = {
    sender: KERNEL,
    nonce: nonceFull,
    initCode: "0x",
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };
  const userOpHash = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [packed],
  })) as Hex;

  const unpacked: UnpackedUserOperationV07 = {
    sender: KERNEL,
    nonce: toHex(nonceFull),
    callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    maxFeePerGas: toHex(maxFeePerGas),
    signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex,
  };
  return { packed, unpacked, userOpHash };
}

export async function buildUpdatePermissionLimitsUO(
  policyId: Hex,
  wallet: Address,
  callType: number,
  target: Address,
  selector: Hex,
  newValueLimit: bigint,
  newDailyLimit: bigint
) {
  await publicClient.readContract({ address: KERNEL, abi: kernelAbi, functionName: "currentNonce" });

  const policyId32 = pad(policyId, { size: 32 }) as Hex;

  const updateCalldata = encodeFunctionData({
    abi: callPolicyAbi,
    functionName: "updatePermissionLimits",
    args: [policyId32, wallet, callType, target, selector, newValueLimit, newDailyLimit],
  });

  const execData = encodeSingle(CALL_POLICY, 0n, updateCalldata);
  const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix());

  const { maxFeePerGas, maxPriorityFeePerGas } = await getCurrentGasPrices();
  const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits("update");

  const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
  const gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas);

  const key192 = ("0x" + "00".repeat(24)) as Hex;
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [KERNEL, BigInt(key192)],
  })) as bigint;

  const packed: PackedUserOperation = {
    sender: KERNEL,
    nonce: nonce64,
    initCode: "0x",
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };

  const userOpHash = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [packed],
  })) as Hex;

  const unpacked: UnpackedUserOperationV07 = {
    sender: KERNEL,
    nonce: toHex(nonce64),
    callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    maxFeePerGas: toHex(maxFeePerGas),
    signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex,
  };

  return { unpacked };
}

export async function buildSendRootUO(target: Address, value: bigint, data: Hex = "0x", _nonceKey = 0) {
  const execData = encodeSingle(target, value, data);
  const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix());

  const { maxFeePerGas, maxPriorityFeePerGas } = await getCurrentGasPrices();
  const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits("install");

  const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
  const gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas);

  const key192 = ("0x" + "00".repeat(24)) as Hex;
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [KERNEL, BigInt(key192)],
  })) as bigint;
  const nonceFull = nonce64;

  const packed: PackedUserOperation = {
    sender: KERNEL,
    nonce: nonceFull,
    initCode: "0x",
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };
  const userOpHash = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [packed],
  })) as Hex;

  const unpacked: UnpackedUserOperationV07 = {
    sender: KERNEL,
    nonce: toHex(nonceFull),
    callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    maxFeePerGas: toHex(maxFeePerGas),
    signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex,
  };
  return { packed, unpacked, userOpHash };
}

export async function buildSendTokenUO(tokenAddress: Address, to: Address, amount: bigint, _nonceKey = 0) {
  const erc20Abi = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);

  const transferCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
  });

  const execData = encodeSingle(tokenAddress, 0n, transferCalldata);
  const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix());

  const { maxFeePerGas, maxPriorityFeePerGas } = await getCurrentGasPrices();
  const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits("install");

  const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
  const gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas);

  const key192 = ("0x" + "00".repeat(24)) as Hex;
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [KERNEL, BigInt(key192)],
  })) as bigint;
  const nonceFull = nonce64;

  const packed: PackedUserOperation = {
    sender: KERNEL,
    nonce: nonceFull,
    initCode: "0x",
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };

  const userOpHash = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [packed],
  })) as Hex;

  const unpacked: UnpackedUserOperationV07 = {
    sender: KERNEL,
    nonce: toHex(nonceFull),
    callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    maxFeePerGas: toHex(maxFeePerGas),
    signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex,
  };

  return { packed, unpacked, userOpHash };
}

export async function buildInstallPermissionUO(delegatedEOA: Address) {
  const permissionId = (keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
      ],
      [KERNEL, delegatedEOA]
    )
  ) as Hex).slice(0, 10) as Hex;

  const vId = vIdFromPermissionId(permissionId);
  const validationData = buildPermissionValidationData(delegatedEOA);

  const current = (await publicClient.readContract({
    address: KERNEL,
    abi: kernelAbi,
    functionName: "currentNonce",
  })) as number;

  const installCalldata = encodeFunctionData({
    abi: kernelInstallValidationsAbi,
    functionName: "installValidations",
    args: [[vId], [{ nonce: current, hook: HOOK_SENTINEL }], [validationData], ["0x"]],
  });
  const execData = encodeSingle(KERNEL, 0n, installCalldata);
  const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix());

  const { maxFeePerGas, maxPriorityFeePerGas } = await getCurrentGasPrices();
  const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits("install");

  const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
  const gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas);

  const key192 = ("0x" + "00".repeat(24)) as Hex;
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [KERNEL, BigInt(key192)],
  })) as bigint;
  const nonceFull = nonce64;

  const packed: PackedUserOperation = {
    sender: KERNEL,
    nonce: nonceFull,
    initCode: "0x",
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };
  const userOpHash = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [packed],
  })) as Hex;

  const unpacked: UnpackedUserOperationV07 = {
    sender: KERNEL,
    nonce: toHex(nonceFull),
    callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    maxFeePerGas: toHex(maxFeePerGas),
    signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex,
  };
  return { unpacked, permissionId, vId };
}

export async function buildInstallCallPolicyUO(delegatedEOA: Address, permissions: CallPolicyPermission[]) {
  const permissionId = (keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
      ],
      [KERNEL, delegatedEOA]
    )
  ) as Hex).slice(0, 10) as Hex;

  const vId = vIdFromPermissionId(permissionId);
  const validationData = buildCallPolicyValidationData(delegatedEOA, permissions);

  const current = (await publicClient.readContract({
    address: KERNEL,
    abi: kernelAbi,
    functionName: "currentNonce",
  })) as number;

  const installCalldata = encodeFunctionData({
    abi: kernelInstallValidationsAbi,
    functionName: "installValidations",
    args: [[vId], [{ nonce: current, hook: HOOK_SENTINEL }], [validationData], ["0x"]],
  });
  const execData = encodeSingle(KERNEL, 0n, installCalldata);
  const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix());

  const { maxFeePerGas, maxPriorityFeePerGas } = await getCurrentGasPrices();
  const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits("install");

  const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
  const gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas);

  const key192 = ("0x" + "00".repeat(24)) as Hex;
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [KERNEL, BigInt(key192)],
  })) as bigint;
  const nonceFull = nonce64;

  const packed: PackedUserOperation = {
    sender: KERNEL,
    nonce: nonceFull,
    initCode: "0x",
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };
  const userOpHash = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [packed],
  })) as Hex;

  const unpacked: UnpackedUserOperationV07 = {
    sender: KERNEL,
    nonce: toHex(nonceFull),
    callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    maxFeePerGas: toHex(maxFeePerGas),
    signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex,
  };
  return { unpacked, permissionId, vId };
}

export async function buildEnableSelectorUO(permissionId: Hex, vId: Hex, _delegatedEOA: Address, selector: Hex) {
  const id20 = identifierWithoutTypeFromPermissionId(permissionId);

  const key192 = encodeAsNonceKey(0x01, 0x02, id20, 0);
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [KERNEL, key192],
  })) as bigint;
  const nonceFull = encodeAsNonce(0x01, 0x02, id20, 0, nonce64);

  const validatorData = "0x";
  const hookData = "0x";
  const selectorData = selector;

  const { maxFeePerGas, maxPriorityFeePerGas } = await getCurrentGasPrices();
  const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits("enable");

  const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
  const gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas);

  const packed: PackedUserOperation = {
    sender: KERNEL,
    nonce: nonceFull,
    initCode: "0x",
    callData: "0x",
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };

  const userOpHash = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [packed],
  })) as Hex;

  const delSig = (await delegated.signMessage({ message: { raw: userOpHash } })) as Hex;
  const userOpSigPermission = buildPermissionUserOpSig(delSig, 1);

  const current = (await publicClient.readContract({
    address: KERNEL,
    abi: kernelAbi,
    functionName: "currentNonce",
  })) as number;
  const [vNonce] = (await publicClient.readContract({
    address: KERNEL,
    abi: kernelAbi,
    functionName: "validationConfig",
    args: [vId],
  })) as [number, Address];

  const enableSig = (await root.signMessage({ message: { raw: userOpHash } })) as Hex;

  const hook20 = ("0x" + HOOK_SENTINEL.slice(2)) as Hex;
  const enablePacked = concat([
    hook20,
    encodeAbiParameters(
      parseAbiParameters("bytes enableSig, bytes userOpSig, bytes validatorData, bytes hookData, bytes selectorData"),
      [enableSig, userOpSigPermission, validatorData, hookData, selectorData]
    ),
  ]);

  const unpacked: UnpackedUserOperationV07 = {
    sender: KERNEL,
    nonce: toHex(nonceFull),
    callData: "0x",
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    maxFeePerGas: toHex(maxFeePerGas),
    signature: enablePacked,
  };
  return { unpacked };
}

export async function buildGrantAccessUO(vId: Hex, selector: Hex, isGrant: boolean) {
  const grantCalldata = encodeFunctionData({
    abi: kernelAbiGrant,
    functionName: "grantAccess",
    args: [vId, selector, isGrant],
  });

  const execData = encodeSingle(KERNEL, 0n, grantCalldata);
  const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix());

  const { maxFeePerGas, maxPriorityFeePerGas } = await getCurrentGasPrices();
  const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits("grant");

  const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
  const gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas);

  const key192 = ("0x" + "00".repeat(24)) as Hex;
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [KERNEL, BigInt(key192)],
  })) as bigint;
  const nonceFull = nonce64;

  const packed: PackedUserOperation = {
    sender: KERNEL,
    nonce: nonceFull,
    initCode: "0x",
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };

  const userOpHash = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [packed],
  })) as Hex;

  const unpacked: UnpackedUserOperationV07 = {
    sender: KERNEL,
    nonce: toHex(nonceFull),
    callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    maxFeePerGas: toHex(maxFeePerGas),
    signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex,
  };

  return { unpacked, userOpHash };
}

export async function buildDelegatedSendUO(
  kernelAddress: Address,
  permissionId: Hex,
  target: Address,
  value: bigint,
  data: Hex,
  delSig: Hex = "0x"
) {
  const id20 = identifierWithoutTypeFromPermissionId(permissionId);

  const key192 = encodeAsNonceKey(0x00, 0x02, id20, 0);
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [kernelAddress, key192],
  })) as bigint;
  const nonceFull = encodeAsNonce(0x00, 0x02, id20, 0, nonce64);

  const execCalldata = encodeSingle(target, value, data);
  const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execCalldata, await rootHookRequiresPrefix());

  const { maxFeePerGas, maxPriorityFeePerGas } = await getCurrentGasPrices();
  const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits("send");

  const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
  const gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas);

  const packed: PackedUserOperation = {
    sender: KERNEL,
    nonce: nonceFull,
    initCode: "0x",
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };
  const userOpHash = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [packed],
  })) as Hex;

  if (delSig === "0x") {
    return { userOpHash };
  }

  const signature = buildPermissionUserOpSig(delSig, 1);

  const unpacked: UnpackedUserOperationV07 = {
    sender: kernelAddress,
    nonce: toHex(nonceFull),
    callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    maxFeePerGas: toHex(maxFeePerGas),
    signature,
  };
  return { unpacked, userOpHash };
}

export async function buildUninstallPermissionUO(delegatedEOA: Address) {
  const permissionId = (keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
      ],
      [KERNEL, delegatedEOA]
    )
  ) as Hex).slice(0, 10) as Hex;

  const vId = vIdFromPermissionId(permissionId);
  const disableData = encodeAbiParameters([{ type: "bytes[]" }], [["0x", "0x"]]);

  const uninstallCalldata = encodeFunctionData({
    abi: kernelInstallValidationsAbi,
    functionName: "uninstallValidation",
    args: [vId, disableData, "0x"],
  });
  const execData = encodeSingle(KERNEL, 0n, uninstallCalldata);
  const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix());

  const { maxFeePerGas, maxPriorityFeePerGas } = await getCurrentGasPrices();
  const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits("uninstall");

  const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
  const gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas);

  const key192 = ("0x" + "00".repeat(24)) as Hex;
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [KERNEL, BigInt(key192)],
  })) as bigint;
  const nonceFull = nonce64;

  const packed: PackedUserOperation = {
    sender: KERNEL,
    nonce: nonceFull,
    initCode: "0x",
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };
  const userOpHash = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [packed],
  })) as Hex;

  const unpacked: UnpackedUserOperationV07 = {
    sender: KERNEL,
    nonce: toHex(nonceFull),
    callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    maxFeePerGas: toHex(maxFeePerGas),
    signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex,
  };
  return { unpacked, permissionId, vId };
}

export async function checkPrefund(userOp: PackedUserOperation | UnpackedUserOperationV07) {
  let sender: Address;
  let preVerificationGas: bigint;
  let callGasLimit: bigint;
  let verificationGasLimit: bigint;
  let maxFeePerGas: bigint;

  if ("accountGasLimits" in userOp) {
    sender = userOp.sender;
    preVerificationGas = userOp.preVerificationGas;

    const [vGas, cGas] = decodeAbiParameters([{ type: "uint128" }, { type: "uint128" }], userOp.accountGasLimits);
    verificationGasLimit = vGas;
    callGasLimit = cGas;

    const [, maxFee] = decodeAbiParameters([{ type: "uint128" }, { type: "uint128" }], userOp.gasFees);
    maxFeePerGas = maxFee;
  } else {
    sender = userOp.sender;
    preVerificationGas = BigInt(userOp.preVerificationGas);
    callGasLimit = BigInt(userOp.callGasLimit);
    verificationGasLimit = BigInt(userOp.verificationGasLimit);
    maxFeePerGas = BigInt(userOp.maxFeePerGas);
  }

  const balanceAbi = parseAbi(["function balanceOf(address account) view returns (uint256)"]);

  const deposit = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: balanceAbi,
    functionName: "balanceOf",
    args: [sender],
  })) as bigint;

  const requiredPrefund = (preVerificationGas + verificationGasLimit + callGasLimit) * maxFeePerGas;

  if (deposit >= requiredPrefund) {
    console.log("✅ Депозита достаточно, можно отправлять UserOp");
  } else {
    console.log("❌ Депозита недостаточно!");
    console.log("Пополните ещё:", (requiredPrefund - deposit).toString(), "wei");
  }
}

export async function getRootCurrentNonce() {
  const key192 = ("0x" + "00".repeat(24)) as Hex;
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [KERNEL, BigInt(key192)],
  })) as bigint;
  return nonce64;
}
