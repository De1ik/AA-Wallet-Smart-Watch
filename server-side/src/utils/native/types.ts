import type { Address, Hex } from "viem";

export type PackedUserOperation = {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex;
  preVerificationGas: bigint;
  gasFees: Hex;
  paymasterAndData: Hex;
  signature: Hex;
};

export type UnpackedUserOperationV07 = {
  sender: Address;
  nonce: Hex;
  callData: Hex;
  callGasLimit: Hex;
  verificationGasLimit: Hex;
  preVerificationGas: Hex;
  maxPriorityFeePerGas: Hex;
  maxFeePerGas: Hex;
  signature: Hex;
};

export interface UserOperation {
  sender: `0x${string}`;
  nonce: bigint;
  callData: `0x${string}`;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  signature: `0x${string}`;
}

export interface CallPolicyPermission {
  callType: number;
  target: `0x${string}`;
  delegatedKey: `0x${string}`;
  selector: `0x${string}`;
  rules: CallPolicyParamRule[];
}

export interface CallPolicyParamRule {
  condition: number;
  offset: bigint;
  params: `0x${string}`[];
}

export enum CallPolicyParamCondition {
  EQUAL = 0,
  GREATER_THAN = 1,
  LESS_THAN = 2,
  GREATER_THAN_OR_EQUAL = 3,
  LESS_THAN_OR_EQUAL = 4,
  NOT_EQUAL = 5,
  ONE_OF = 6,
}
