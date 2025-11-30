import { ExecuteDelegateInstallation, PermissionPolicyType, PrepareDataForSigning } from "@/types/types";
import { Address } from "viem";

export interface HttpResult<T> {
  status: number;
  body: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
}

export const badRequest = (message: string): HttpResult<ErrorResponse> => ({
  status: 400,
  body: { success: false, error: message },
});

export const ok = (body: any): HttpResult<any> => ({
  status: 200,
  body,
});

export const rateLimit = (msg: string): HttpResult<{ error: string; message: string; retryAfter: number }> => ({
  status: 429,
  body: {
    error: "Rate limit exceeded",
    message: msg,
    retryAfter: 5,
  },
});

export const internalError = (msg: string, err: any): HttpResult<ErrorResponse> => ({
  status: 500,
  body: { success: false, error: msg, details: err?.message },
});

// ------------------ new added --------------

export interface InstallPrepareInput {
  delegatedAddress: string;
  keyType: PermissionPolicyType;
  clientId?: string;
  permissions?: any;
  callPolicyConfig?: any;
  kernelAddress: string;
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

// ------------------ entry point deposit --------------

export interface EntryPointDepositPrepareInput {
  amountEth: string;
  kernelAddress: Address;
}

export interface prepareEntryPointDeposit {
  success: boolean;
  data: PrepareDataForSigning;
  message: string;
}

export interface executedEntryPointDeposit {
  success: boolean;
  data: { txHash: string, gasUsed: string };
  message: string;
}

