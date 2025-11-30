import { Address, Hex } from "viem"

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
  paymaster?: Hex;
  paymasterVerificationGasLimit?: Hex;
  paymasterPostOpGasLimit?: Hex;
  paymasterData?: Hex;
}

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
  }