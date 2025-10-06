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
}

export interface RevokeKeyResponse {
  success: boolean;
  txHash: string;
  message: string;
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
    keyType: 'sudo' | 'restricted';
    clientId?: string;
  }): Promise<CreateDelegatedKeyResponse> {
    return this.makeRequest<CreateDelegatedKeyResponse>('/wallet/delegated/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Check prefund status
  async checkPrefund(): Promise<PrefundCheckResponse> {
    return this.makeRequest<PrefundCheckResponse>('/wallet/prefund/check');
  }

  // Revoke delegated key access
  async revokeKey(delegatedEOA: string): Promise<RevokeKeyResponse> {
    return this.makeRequest<RevokeKeyResponse>('/wallet/revoke', {
      method: 'POST',
      body: JSON.stringify({ delegatedEOA }),
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
