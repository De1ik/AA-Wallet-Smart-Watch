import { z } from 'zod';

import {
  AllowedToken,
  BalancesResponse,
  CallPolicyData,
  CallPolicyResponse,
  InstallExecuteSuccess,
  InstallPrepareSuccess,
  PermissionPolicyType,
  PrefundCheckResponse,
  PrepareDataForSigning,
  RevokeKeyResponse,
  SendTransactionResponse,
  SignedDataForDelegateInstallation,
  TokenBalance,
  Transaction,
  TransactionsResponse,
  TxStatus,
  TxType,
} from '@/domain/types';
import type { ErrorResponse, executedEntryPointDeposit, prepareEntryPointDeposit } from './apiTypes';
import { isAddress, isHex } from 'viem';
import type { Address, Hex } from 'viem';

const hexString = z
  .string()
  .refine((value): value is Hex => isHex(value, { strict: true }), 'Invalid hex string') as z.ZodType<Hex>;
const addressString = z
  .string()
  .refine((value): value is Address => isAddress(value), 'Invalid address') as z.ZodType<Address>;

const prepareDataForSigningSchema: z.ZodType<PrepareDataForSigning> = z.object({
  unpacked: z.any(),
  packed: z.any(),
  userOpHash: hexString,
});

const signedDataSchema: z.ZodType<SignedDataForDelegateInstallation> = z.object({
  unpacked: z.any(),
  signature: hexString,
});

const decimalString = (field: string) =>
  z
    .string()
    .refine((value) => /^[0-9]+(\.[0-9]+)?$/.test(value), `${field} must be a numeric string`);

const tokenBalanceSchema: z.ZodType<TokenBalance> = z.object({
  symbol: z.string(),
  name: z.string(),
  balance: decimalString('balance'),
  value: z.number(),
  decimals: z.number(),
  address: addressString,
  color: z.string(),
  amount: decimalString('amount'),
});

export const BalancesResponseSchema: z.ZodType<BalancesResponse> = z.object({
  success: z.boolean(),
  ethBalance: z.string(),
  tokens: z.array(tokenBalanceSchema),
  message: z.string(),
});

const txTypeSchema: z.ZodType<TxType> = z.nativeEnum(TxType);

const txStatusSchema: z.ZodType<TxStatus> = z.nativeEnum(TxStatus);

const transactionSchema: z.ZodType<Transaction> = z.object({
  hash: hexString.or(z.string()),
  from: addressString.or(z.string()),
  to: addressString.or(z.string()),
  value: decimalString('value'),
  timestamp: z.number(),
  type: txTypeSchema,
  status: txStatusSchema,
  tokenSymbol: z.string().optional(),
  tokenAddress: addressString.optional(),
  eventType: z.string().optional(),
  errorMessage: z.string().optional(),
  tokenId: z.string().optional(),
});

export const TransactionsResponseSchema: z.ZodType<TransactionsResponse> = z.object({
  success: z.boolean(),
  transactions: z.array(transactionSchema),
  message: z.string(),
  limit: z.number(),
});

const allowedTokenSchema: z.ZodType<AllowedToken> = z.object({
  token: z.string(),
  symbol: z.string().optional(),
  name: z.string().optional(),
  decimals: z.number().optional(),
  enabled: z.boolean(),
  txLimit: z.string(),
  dailyLimit: z.string(),
  usage: z
    .object({
      used: z.string(),
      limit: z.string(),
      remaining: z.string(),
      percentage: z.number(),
    })
    .nullable()
    .optional(),
});

const callPolicyDataSchema: z.ZodType<CallPolicyData> = z.object({
  status: z.number(),
  statusText: z.string(),
  isActive: z.boolean(),
  allowedTokens: z.array(allowedTokenSchema),
  allowedRecipients: z.array(addressString),
});

export const CallPolicyResponseSchema: z.ZodType<CallPolicyResponse> = z.object({
  success: z.boolean(),
  delegatedKey: addressString,
  policyId: z.string(),
  data: callPolicyDataSchema,
});

export const RevokeKeyResponseSchema: z.ZodType<RevokeKeyResponse> = z.object({
  success: z.boolean(),
  txHash: hexString,
  message: z.string(),
});

export const SendTransactionResponseSchema: z.ZodType<SendTransactionResponse> = z.object({
  success: z.boolean(),
  txHash: hexString,
  message: z.string(),
  error: z.string().optional(),
});

export const PrefundCheckResponseSchema: z.ZodType<PrefundCheckResponse> = z.object({
  hasPrefund: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
  details: z.string().optional(),
  depositWei: decimalString('depositWei').optional(),
  requiredPrefundWei: decimalString('requiredPrefundWei').optional(),
  shortfallWei: decimalString('shortfallWei').optional(),
  kernelAddress: addressString.optional(),
  entryPointAddress: addressString.optional(),
});

const prepareDelegateDataSchema = z.object({
  permissionPolicyType: z.nativeEnum(PermissionPolicyType),
  unsignedPermissionPolicyData: prepareDataForSigningSchema,
  unsignedGrantAccessData: prepareDataForSigningSchema,
  unsignedRecipientListData: prepareDataForSigningSchema.optional(),
  unsignedTokenListData: prepareDataForSigningSchema.optional(),
});

export const InstallPrepareSuccessSchema: z.ZodType<InstallPrepareSuccess> = z.object({
  success: z.boolean(),
  installationId: z.string(),
  data: prepareDelegateDataSchema,
  message: z.string(),
});

export const InstallExecuteSuccessSchema: z.ZodType<InstallExecuteSuccess> = z.object({
  success: z.boolean(),
  installationId: z.string(),
  message: z.string(),
});

export const ErrorResponseSchema: z.ZodType<ErrorResponse> = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.string().optional(),
});

export const InstallPrepareResultSchema = InstallPrepareSuccessSchema.or(ErrorResponseSchema);
export type InstallPrepareResult = z.infer<typeof InstallPrepareResultSchema>;

const executeDelegateInstallationSchema = z.object({
  permissionPolicyType: z.nativeEnum(PermissionPolicyType),
  signedPermissionPolicyData: signedDataSchema,
  signedGrantAccessData: signedDataSchema,
  signedRecipientListData: signedDataSchema.optional(),
  signedTokenListData: signedDataSchema.optional(),
});

export const InstallExecuteResultSchema = InstallExecuteSuccessSchema.or(ErrorResponseSchema);
export type InstallExecuteResult = z.infer<typeof InstallExecuteResultSchema>;

export const EntryPointDepositPrepareSchema: z.ZodType<prepareEntryPointDeposit> = z.object({
  success: z.boolean(),
  data: prepareDataForSigningSchema,
  message: z.string(),
});

export const EntryPointDepositExecuteSchema: z.ZodType<executedEntryPointDeposit> = z.object({
  success: z.boolean(),
  data: z.object({
    txHash: hexString,
    gasUsed: decimalString('gasUsed'),
  }),
  message: z.string(),
});

export const EntryPointDepositPrepareResultSchema = EntryPointDepositPrepareSchema.or(ErrorResponseSchema);
export type EntryPointDepositPrepareResult = z.infer<typeof EntryPointDepositPrepareResultSchema>;

export const EntryPointDepositExecuteResultSchema = EntryPointDepositExecuteSchema.or(ErrorResponseSchema);
export type EntryPointDepositExecuteResult = z.infer<typeof EntryPointDepositExecuteResultSchema>;

export const HealthCheckResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  message: z.string(),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

export const DelegatedKeysResponseSchema = z.object({
  success: z.boolean(),
  allDelegatedKeys: z.array(addressString),
});
export type DelegatedKeysResponse = z.infer<typeof DelegatedKeysResponseSchema>;

export { executeDelegateInstallationSchema };
