import { PackedUserOperation, UnpackedUserOperationV07 } from "@/services/blockchain/types";
import { Address, Hex } from "viem";

export enum CallType {
  CALLTYPE_SINGLE = 0,
  CALLTYPE_BATCH = 1,
  CALLTYPE_DELEGATECALL = 2
}

export enum ParamCondition {
  EQUAL = 0,
  GREATER_THAN = 1,
  LESS_THAN = 2,
  GREATER_THAN_OR_EQUAL = 3,
  LESS_THAN_OR_EQUAL = 4,
  NOT_EQUAL = 5,
  ONE_OF = 6,
}

export enum TxType {
  SENT = 0,
  RECEIVED = 1
}

export enum TxStatus {
  SUCCESS = 0,
  FAILED = 1,
  PENDING = 2
}

export enum TokenType {
  ETH = 0,
  ERC20 = 1,
  ERC721 = 2,
  ERC1155 = 3
}

export enum InstallStep {
  INSTALLING=0,
  GRANTING=1,
  COMPLETED=2,
  FAILED=3
}

export enum PermissionPolicyType {
  SUDO = 0,
  CALL_POLICY = 1,
}

export interface ParamRule {
    condition: ParamCondition;
    offset: number;
    params: string[];
}

export interface Permission {
    callType: CallType;   
    target: string;   
    delegatedKey: string;
    selector: string;
    rules: ParamRule[];
}

export interface TokenLimit {
  enabled: boolean;
  txLimit: string;
  dailyLimit: string;
}

export interface TokenLimitEntry {
  token: string;
  limit: TokenLimit;
}

export interface PermissionTokenEntry {
    permission: Permission,
    tokenLimitEntry: TokenLimitEntry
}

export interface AllPermissionsPerDelegatedKey {
    delegatedKey: string;
    allowedTokens: string[];
    allowedRecipients: string[];
    tokenLimits: TokenLimitEntry[];
}

export interface RequestCreateDelegateKey {
    permissions: PermissionTokenEntry[]
}


// ---------------- API Response types ----------------

export interface AllowedToken {
  token: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  enabled: boolean;
  txLimit: string;
  dailyLimit: string;
  usage?: {
    used: string;
    limit: string;
    remaining: string;
    percentage: number;
  } | null;
}

export interface CallPolicyData {
  status: number;
  statusText: string;
  isActive: boolean;
  allowedTokens: AllowedToken[];
  allowedRecipients: string[];
}

export interface CallPolicyResponse {
  success: boolean;
  delegatedKey: string;
  policyId: string;
  data: CallPolicyData;
}


// ---------------- API Response types ----------------

export interface ApiResponse<T = any> {
  success?: boolean;
  error?: string;
  data?: T;
}

export interface NonceResponse {
  nonce: string;
}

export interface InstallPermissionResponse {
  permissionId: string;
  vId: string;
  txHash: string;
}

export interface EnableSelectorResponse {
  txHash: string;
}

export interface GrantAccessResponse {
  txHash: string;
}

export interface UninstallPermissionResponse {
  permissionId: string;
  vId: string;
  txHash: string;
}

export interface UserOpPrepareResponse {
  userOpHash: string;
  echo: {
    permissionId: string;
    to: string;
    amountWei: string;
    data: string;
  };
}

export interface UserOpBroadcastResponse {
  txHash: string;
}

export interface InstallationStatus {
  step: InstallStep;
  message: string;
  progress: number; // 0-100
  txHash?: string;
  error?: string;
  permissionId?: string;
  vId?: string;
}

export interface CreateDelegatedKeyResponse {
  success: boolean;
  installationId: string;
  message: string;
}

export interface PrefundCheckResponse {
  hasPrefund: boolean;
  message: string;
  error?: string;
  details?: string;
  depositWei?: string;
  requiredPrefundWei?: string;
  shortfallWei?: string;
  kernelAddress?: string;
  entryPointAddress?: string;
}

export interface EntryPointDepositResponse {
  success: boolean;
  txHash?: string;
  userOpHash?: string;
  message: string;
  error?: string;
  kernelAddress?: string;
  entryPointAddress?: string;
  amountWei?: string;
  gasUsed?: string;
  revertReason?: string;
  details?: string;
}

export interface RevokeKeyResponse {
  success: boolean;
  txHash: string;
  message: string;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  value: number;
  decimals: number;
  address: string;
  color: string;
  amount: string;
}

export interface BalancesResponse {
  success: boolean;
  ethBalance: string;
  tokens: TokenBalance[];
  message: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  type: TxType;
  status: TxStatus;
  tokenSymbol?: string;
  tokenAddress?: string;
  eventType?: string;
  errorMessage?: string;
  tokenId?: string; // For NFTs
}

export interface TransactionsResponse {
  success: boolean;
  transactions: Transaction[];
  message: string;
  limit: number;
}

export interface SendTransactionResponse {
  success: boolean;
  txHash: string;
  message: string;
  error?: string;
}



//  ------------------ new added --------------

export interface SignedDataForDelegateInstallation {
  unpacked: UnpackedUserOperationV07;
  signature: Hex;
}

export interface PrepareDataForSigning {
  unpacked: UnpackedUserOperationV07;
  packed: PackedUserOperation;
  userOpHash: Hex;
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

export interface ExecuteDelegateInstallation {
  permissionPolicyType: PermissionPolicyType;
  signedPermissionPolicyData: SignedDataForDelegateInstallation;
  signedGrantAccessData: SignedDataForDelegateInstallation;
  signedRecipientListData?: SignedDataForDelegateInstallation;
  signedTokenListData?: SignedDataForDelegateInstallation;
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
