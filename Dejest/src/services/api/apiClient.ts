import { BroadcastUserOpResponse, SignedDataForDelegateInstallation } from '@/domain/types';
import { config } from '@/config/env';

import { 
  PrefundCheckResponse,
  BalancesResponse,
  TransactionsResponse,
  SendTransactionResponse,
  CallPolicyResponse,
} from '@/domain/types';
import { EntryPointDepositPrepareInput, InstallExecuteInput, InstallPrepareInput, RevokeExecuteInput, RevokePrepareInput } from './apiTypes';

import {
  BalancesResponseSchema,
  CallPolicyResponseSchema,
  DelegatedKeysResponseSchema,
  EntryPointDepositExecuteResultSchema,
  EntryPointDepositPrepareResultSchema,
  HealthCheckResponseSchema,
  InstallExecuteResultSchema,
  InstallPrepareResultSchema,
  PrefundCheckResponseSchema,
  RevokeExecuteResultSchema,
  RevokePrepareResultSchema,
  SendTransactionResponseSchema,
  BroadcastUserOpResponseSchema,
  TransactionsResponseSchema,
  type DelegatedKeysResponse,
  type EntryPointDepositExecuteResult,
  type EntryPointDepositPrepareResult,
  type HealthCheckResponse,
  type InstallExecuteResult,
  type InstallPrepareResult,
  type RevokeExecuteResult,
  type RevokePrepareResult,
} from './schemas';
import { debugLog } from '@/shared/helpers/helper';


class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.API_BASE_URL || 'http://localhost:4000';
  }

  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<unknown> {
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

  // Revoke delegated key access
  async prepareRevokeKey(params: RevokePrepareInput): Promise<RevokePrepareResult> {
    const data = await this.makeRequest('/wallet/delegated/revoke/prepare-data', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return RevokePrepareResultSchema.parse(data);
  }

  // Revoke delegated key access
  async executeRevokeKey(params: RevokeExecuteInput): Promise<RevokeExecuteResult> {
    const data = await this.makeRequest('/wallet/delegated/revoke/execute', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return RevokeExecuteResultSchema.parse(data);
  }


    // Simplified delegated key creation (new functionality)
  async prepareDelegatedKeyInstall(params: InstallPrepareInput): Promise<InstallPrepareResult> {
    const data = await this.makeRequest('/wallet/delegated/install/prepare-data', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return InstallPrepareResultSchema.parse(data);
  }

  async executeDelegatedKeyInstall(params: InstallExecuteInput): Promise<InstallExecuteResult> {
    const data = await this.makeRequest('/wallet/delegated/install/execute', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return InstallExecuteResultSchema.parse(data);
  }


  async prepareDepositToEntryPoint(params: EntryPointDepositPrepareInput): Promise<EntryPointDepositPrepareResult> {
    const data = await this.makeRequest('/wallet/entrypoint/deposit/prepare-data', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return EntryPointDepositPrepareResultSchema.parse(data);
  }

  async executeDepositToEntryPoint(params: SignedDataForDelegateInstallation): Promise<EntryPointDepositExecuteResult> {
    const data = await this.makeRequest('/wallet/entrypoint/deposit/execute', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return EntryPointDepositExecuteResultSchema.parse(data);
  }





  // Send ETH or ERC20 tokens
  async sendTransaction(params: {
    to: string;
    amount: string;
    kernelAddress: string;
    tokenAddress?: string;
  }): Promise<SendTransactionResponse> {
    const data = await this.makeRequest('/wallet/send', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return SendTransactionResponseSchema.parse(data);
  }

  async broadcastUserOperation(payload: SignedDataForDelegateInstallation): Promise<BroadcastUserOpResponse> {
    const data = await this.makeRequest('/wallet/userOp/send-uop', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return BroadcastUserOpResponseSchema.parse(data);
  }

  // ----------------------- READ ONLY -----------------------


  // Health check
  async healthCheck(): Promise<HealthCheckResponse> {
    const data = await this.makeRequest('/wallet/health');
    return HealthCheckResponseSchema.parse(data);
  }

  // CallPolicy data fetching
  async fetchCallPolicyPermissions(params: {
    owner: string;
    delegatedKey: string;
  }): Promise<CallPolicyResponse> {
    const data = await this.makeRequest('/wallet/callpolicy/info', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    debugLog("RESPONSE FROM INFO:")
    debugLog("data:", data)
    return CallPolicyResponseSchema.parse(data);
  }

  // Fetch all delegated keys for an owner (kernel)
  async fetchAllDelegatedKeys(params: { owner: string }): Promise<DelegatedKeysResponse> {
    const data = await this.makeRequest('/wallet/callpolicy/delegated-keys', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return DelegatedKeysResponseSchema.parse(data);
  }

  // Get token balances for an address
  async getBalances(address: string): Promise<BalancesResponse> {
    const data = await this.makeRequest(`/wallet/balances?address=${address}`);
    return BalancesResponseSchema.parse(data);
  }

  // Get transaction history for an address
  async getTransactions(address: string, limit: number = 20): Promise<TransactionsResponse> {
    const data = await this.makeRequest(`/wallet/transactions?address=${address}&limit=${limit}`);
    return TransactionsResponseSchema.parse(data);
  }

  // Check prefund status
  async checkPrefund(kernelAddress?: string): Promise<PrefundCheckResponse> {
    try {
      const addr = kernelAddress || config.KERNEL;
      const data = await this.makeRequest(`/wallet/entrypoint/status?kernelAddress=${addr}`);
      return PrefundCheckResponseSchema.parse(data);
    } catch (error) {
      const trackedError = error instanceof Error ? error.message : 'Unknown prefund error';
      console.warn('[ApiClient] Prefund check error tracked:', trackedError);
      return PrefundCheckResponseSchema.parse({
        hasPrefund: false,
        message: trackedError,
        error: trackedError,
        kernelAddress: kernelAddress || config.KERNEL,
        entryPointAddress: config.ENTRY_POINT,
      });
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
