import { AllPermissionsPerDelegatedKey, RequestCreateDelegateKey } from '@/types/types';
import { config } from './config';

import { 
  ApiResponse,
  NonceResponse,
  InstallPermissionResponse,
  EnableSelectorResponse,
  GrantAccessResponse,
  UninstallPermissionResponse,
  UserOpPrepareResponse,
  UserOpBroadcastResponse,
  InstallationStatus,
  CreateDelegatedKeyResponse,
  PrefundCheckResponse,
  EntryPointDepositResponse,
  RevokeKeyResponse,
  TokenBalance,
  BalancesResponse,
  Transaction,
  TransactionsResponse,
  SendTransactionResponse,
  CallPolicyResponse
} from '@/types/types';



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
      console.log(`[ApiClient] -> Making request to ${url}`, options.body ? JSON.parse(options.body as string) : '');
      
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
      console.log(`[ApiClient] -> Success response from ${url}:`, data);
      return data;
    } catch (error) {
      console.error(`[ApiClient] -> Request failed for ${endpoint}:`, error);
      
      // Enhance error messages for common scenarios
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Network error: Unable to connect to server at ${this.baseUrl}. Please check your connection and server status.`);
      }
      
      throw error;
    }
  }

  // Simplified delegated key creation (new functionality)
  async createDelegatedKey(params: {
    delegatedEOA: `0x${string}`;
    keyType: 'sudo' | 'restricted' | 'callpolicy';
    clientId: string;
    permissions: RequestCreateDelegateKey;
    kernelAddress: string;
  }): Promise<CreateDelegatedKeyResponse> {
    return this.makeRequest<CreateDelegatedKeyResponse>('/wallet/delegated/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Revoke delegated key access
  async revokeKey(delegatedEOA: string, kernelAddress: string): Promise<RevokeKeyResponse> {
    return this.makeRequest<RevokeKeyResponse>('/wallet/revoke', {
      method: 'POST',
      body: JSON.stringify({ delegatedEOA, kernelAddress }),
    });
  }

  async depositToEntryPoint(amountEth: string): Promise<EntryPointDepositResponse> {
    return this.makeRequest<EntryPointDepositResponse>('/wallet/entrypoint/deposit', {
      method: 'POST',
      body: JSON.stringify({ amountEth }),
    });
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

  // ----------------------- READ ONLY -----------------------


  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string; message: string }> {
    return this.makeRequest('/wallet/health');
  }

  // CallPolicy data fetching
  async fetchCallPolicyPermissions(params: {
    owner: string;
    delegatedKey: string;
  }): Promise<CallPolicyResponse> {
    return this.makeRequest<CallPolicyResponse>('/wallet/callpolicy/info', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Fetch all delegated keys for an owner (kernel)
  async fetchAllDelegatedKeys(params: { owner: string }): Promise<{ success: boolean; allDelegatedKeys: string[] }> {
    return this.makeRequest('/wallet/callpolicy/delegated-keys', {
      method: 'POST',
      body: JSON.stringify(params),
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
}

// Export singleton instance
export const apiClient = new ApiClient();
