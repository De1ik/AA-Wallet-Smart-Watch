import { AllPermissionsPerDelegatedKey, RequestCreateDelegateKey } from '@/types/types';
import { config } from './config';

// API Response types
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
  step: 'installing' | 'granting' | 'completed' | 'failed';
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
  type: 'sent' | 'received';
  status: 'success' | 'pending' | 'failed';
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

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.API_BASE_URL || 'http://localhost:4000';
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log(`[ApiClient] Making request to ${url}`, options.body ? JSON.parse(options.body as string) : '');
      
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, use the default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`[ApiClient] Success response from ${url}:`, data);
      return data;
    } catch (error) {
      console.error(`[ApiClient] Request failed for ${endpoint}:`, error);
      
      // Enhance error messages for common scenarios
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Network error: Unable to connect to server at ${this.baseUrl}. Please check your connection and server status.`);
      }
      
      throw error;
    }
  }

  // Get current root nonce
  async getRootNonce(): Promise<NonceResponse> {
    return this.makeRequest<NonceResponse>('/wallet/nonce/root');
  }

  // Install permission validation for delegated key
  async installPermission(delegatedEOA: string): Promise<InstallPermissionResponse> {
    return this.makeRequest<InstallPermissionResponse>('/wallet/delegated/install', {
      method: 'POST',
      body: JSON.stringify({ delegatedEOA }),
    });
  }

  // Enable selector for delegated key
  async enableSelector(
    permissionId: string,
    vId: string,
    delegatedEOA: string
  ): Promise<EnableSelectorResponse> {
    return this.makeRequest<EnableSelectorResponse>('/wallet/delegated/enable', {
      method: 'POST',
      body: JSON.stringify({ permissionId, vId, delegatedEOA }),
    });
  }

  // Grant access to execute selector
  async grantAccess(vId: string): Promise<GrantAccessResponse> {
    return this.makeRequest<GrantAccessResponse>('/wallet/delegated/grant', {
      method: 'POST',
      body: JSON.stringify({ vId }),
    });
  }

  // Uninstall permission validation
  async uninstallPermission(delegatedEOA: string): Promise<UninstallPermissionResponse> {
    return this.makeRequest<UninstallPermissionResponse>('/wallet/delegated/uninstall', {
      method: 'POST',
      body: JSON.stringify({ delegatedEOA }),
    });
  }

  // Prepare user operation (existing functionality)
  async prepareUserOp(params: {
    to: string;
    amountWei: string;
    data?: string;
    delegatedEOA: string;
    kernelAddress: string;
  }): Promise<UserOpPrepareResponse> {
    return this.makeRequest<UserOpPrepareResponse>('/wallet/userOp/prepare', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Broadcast user operation (existing functionality)
  async broadcastUserOp(params: {
    to: string;
    amountWei: string;
    data?: string;
    delegatedEOA: string;
    signature: string;
    opHash: string;
    kernelAddress: string;
  }): Promise<UserOpBroadcastResponse> {
    return this.makeRequest<UserOpBroadcastResponse>('/wallet/userOp/broadcast', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Simplified delegated key creation (new functionality)
  async createDelegatedKey(params: {
    delegatedEOA: string;
    keyType: 'sudo' | 'restricted' | 'callpolicy';
    clientId: string;
    permissions: RequestCreateDelegateKey;
  }): Promise<CreateDelegatedKeyResponse> {
    return this.makeRequest<CreateDelegatedKeyResponse>('/wallet/delegated/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Check prefund status
  async checkPrefund(): Promise<PrefundCheckResponse> {
    try {
      return await this.makeRequest<PrefundCheckResponse>('/wallet/entrypoint/status');
    } catch (error) {
      const trackedError = error instanceof Error ? error.message : 'Unknown prefund error';
      console.warn('[ApiClient] Prefund check error tracked:', trackedError);
      return {
        hasPrefund: false,
        message: trackedError,
        error: trackedError,
        kernelAddress: config.KERNEL,
        entryPointAddress: config.ENTRY_POINT,
      };
    }
  }

  // Revoke delegated key access
  async revokeKey(delegatedEOA: string): Promise<RevokeKeyResponse> {
    return this.makeRequest<RevokeKeyResponse>('/wallet/revoke', {
      method: 'POST',
      body: JSON.stringify({ delegatedEOA }),
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string; message: string }> {
    return this.makeRequest('/wallet/health');
  }

  // CallPolicy data fetching
  async fetchCallPolicyPermissions(params: {
    kernelAddress: string;
    delegatedEOA: string;
    permissionId: string;
  }): Promise<{
    success: boolean;
    permissions: any[];
    count: number;
    message: string;
  }> {
    return this.makeRequest('/wallet/callpolicy/fetch', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async checkPermissionExists(params: {
    kernelAddress: string;
    delegatedEOA: string;
    permissionId: string;
    callType: number;
    target: string;
    selector: string;
  }): Promise<{
    success: boolean;
    exists: boolean;
    message: string;
  }> {
    return this.makeRequest('/wallet/callpolicy/check', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Get all permissions with daily usage for a policy
  async getAllCallPolicyPermissionsWithUsage(params: {
    policyId: string;
    owner: string;
  }): Promise<{
    success: boolean;
    permissions: AllPermissionsPerDelegatedKey;
    message: string;
  }> {
    return this.makeRequest('/wallet/callpolicy/all-permissions-with-usage', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Get today's daily usage for a specific permission
  async getCallPolicyDailyUsageToday(params: {
    policyId: string;
    wallet: string;
    permissionHash: string;
  }): Promise<{
    success: boolean;
    dailyUsage: string;
    message: string;
  }> {
    return this.makeRequest('/wallet/callpolicy/daily-usage-today', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async regeneratePermissionId(params: {
    kernelAddress: string;
    delegatedEOA: string;
  }): Promise<{
    success: boolean;
    permissionId: string;
    vId: string;
    message: string;
  }> {
    return this.makeRequest('/wallet/callpolicy/regenerate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async depositToEntryPoint(amountEth: string): Promise<EntryPointDepositResponse> {
    return this.makeRequest<EntryPointDepositResponse>('/wallet/entrypoint/deposit', {
      method: 'POST',
      body: JSON.stringify({ amountEth }),
    });
  }

  // Get token balances for an address
  async getBalances(address: string): Promise<BalancesResponse> {
    return this.makeRequest<BalancesResponse>(`/wallet/balances?address=${address}`);
  }

  // Get transaction history for an address
  async getTransactions(address: string, limit: number = 20): Promise<TransactionsResponse> {
    return this.makeRequest<TransactionsResponse>(`/wallet/transactions?address=${address}&limit=${limit}`);
  }

  // Send ETH or ERC20 tokens
  async sendTransaction(params: {
    to: string;
    amount: string;
    tokenAddress?: string;
  }): Promise<SendTransactionResponse> {
    return this.makeRequest<SendTransactionResponse>('/wallet/send', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
