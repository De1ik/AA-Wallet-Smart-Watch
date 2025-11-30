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
  paymaster?: Hex;
  paymasterVerificationGasLimit?: Hex;
  paymasterPostOpGasLimit?: Hex;
  paymasterData?: Hex;
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


export enum PermissionPolicyType {
  SUDO = 0,
  CALL_POLICY = 1,
}

export interface SendUOpRequest {
  unpacked: UnpackedUserOperationV07;
  signature: string;
  delegatedAddress: Address;
}


export interface PrepareDataForSigning {
  unpacked: UnpackedUserOperationV07;
  packed: PackedUserOperation;
  userOpHash: Hex;
}

export interface PrepareDelegateInstallation {
  permissionPolicyType: PermissionPolicyType;
  unsignedPermissionPolicyData: PrepareDataForSigning;
  unsignedGrantAccessData: PrepareDataForSigning;
  unsignedRecipientListData?: PrepareDataForSigning;
  unsignedTokenListData?: PrepareDataForSigning;
}


export interface DelegateInstallationPrepareData {
  isSuccess: boolean;
  data?: PrepareDelegateInstallation;
}


// ----- SIGNED -----

export interface SignedDataForDelegateInstallation {
  unpacked: UnpackedUserOperationV07;
  signature: Hex;
}

export interface ExecuteDelegateInstallation {
  permissionPolicyType: PermissionPolicyType;
  signedPermissionPolicyData: SignedDataForDelegateInstallation;
  signedGrantAccessData: SignedDataForDelegateInstallation;
  signedRecipientListData?: SignedDataForDelegateInstallation;
  signedTokenListData?: SignedDataForDelegateInstallation;
}

// ----------- convertToCallPolicyPermissions -----------
export interface PermissionRule {
  condition: number;
  offset: bigint;
  params: `0x${string}`[];
}

// ----------- ----------- ----------- ----------- -----------

export type TokenLimitInput = {
  token: string;
  txLimit: string | number;
  dailyLimit: string | number;
  decimals?: number;
  enabled?: boolean;
};

export type CallPolicyConfigInput = {
  tokenLimits?: TokenLimitInput[];
  recipients?: string[];
};

export type NormalizedTokenLimit = {
  token: Address;
  txLimit: bigint;
  dailyLimit: bigint;
  enabled: boolean;
};

export type NormalizedCallPolicyPayload = {
  callPolicyPermissions: CallPolicyPermission[];
  tokenLimits: NormalizedTokenLimit[];
  recipients: Address[];
};

export interface RevokePrepareInput {
  delegatedEOA: string;
  kernelAddress: string;
}

export interface RevokeExecuteInput {
  data: SignedDataForDelegateInstallation;
  kernelAddress: string;
}

export interface InstallPrepareInput {
  delegatedAddress: string;
  keyType: PermissionPolicyType;
  clientId?: string;
  permissions?: any;
  callPolicyConfig?: any;
  kernelAddress: string;
}

export interface InstallPrepareSuccess {
  success: boolean;
  installationId: string;
  data: {  
    permissionPolicyType: PermissionPolicyType;
    unsignedPermissionPolicyData: PrepareDataForSigning;
    unsignedGrantAccessData: PrepareDataForSigning;
    unsignedRecipientListData?: PrepareDataForSigning;
    unsignedTokenListData?: PrepareDataForSigning;
  };                     
  message: string;
}

export interface InstallExecuteInput {
  data: ExecuteDelegateInstallation;
  clientId: string;
  kernelAddress: Address;
  installationId: string;
}

export interface InstallExecuteSuccess {
  success: boolean;
  installationId: string;
  message: string;
}

export interface RevokePrepareSuccess {
  success: boolean;
  data?: PrepareDataForSigning;
  message: string;
  error?: string;
}

export interface RevokeExecuteSuccess {
  success: boolean;
  data?: string;
  message: string;
}
