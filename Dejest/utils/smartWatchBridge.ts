import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

// TypeScript interfaces for the native bridge
interface IWalletBridge {
  sendToWatch: (payload: Record<string, any>) => void;
  resolveAccountData: (requestId: string, data: { balance: string; address: string; history: any[] }) => void;
  pingWatch: () => Promise<boolean>;
  generateKeyPair: (data: WatchGenarteKeyData) => Promise<{
    success: boolean;
    data?: { address: string };
    type: string;
  }>;
  syncPermissionData: (data: any) => Promise<boolean>;
  getAccountData: () => Promise<{ balance: string; address: string; history: any[] }>;
}

// Get the native module
const { WalletBridge } = NativeModules as { WalletBridge: IWalletBridge };
const walletEvents = new NativeEventEmitter(WalletBridge as any);

// Export types for use in other files
export interface WatchKeyPair {
  address: string;
}

export interface WatchPermissionData {
  permissionId: string;
  vId: string;
  deviceName: string;
  keyType: 'restricted' | 'sudo';
  createdAt: string;
}

export interface WatchGenarteKeyData {
  kernelAddress: string;
}


// Listen for account data requests from the watch
walletEvents.addListener('FetchAccountData', async (payload: { requestId: string }) => {
  console.log('WalletBridge', NativeModules.WalletBridge);
  console.log('Account data request from watch:', payload);

  try {
    // Get real account data (you can replace this with actual wallet data)
    const accountData = await smartWatchBridge.getAccountData();
    
    // Send response back to watch
    if (Platform.OS === 'ios' && WalletBridge?.resolveAccountData) {
      WalletBridge.resolveAccountData(payload.requestId, accountData);
    } else {
      console.warn('WalletBridge.resolveAccountData not available');
    }
    } catch (error) {
    console.error('Error fetching account data:', error);
    // Send error response
    if (Platform.OS === 'ios' && WalletBridge?.resolveAccountData) {
      WalletBridge.resolveAccountData(payload.requestId, {
        balance: "0",
        address: "error",
        history: []
      });
    }
  }
});

// Smart Watch Bridge implementation
export const smartWatchBridge = {
  /**
   * Check if smart watch is connected
   */
  async pingWatch(): Promise<boolean> {
    if (Platform.OS === 'ios' && WalletBridge?.pingWatch) {
      try {
        return await WalletBridge.pingWatch();
      } catch (error) {
        console.error('Error pinging watch:', error);
        return false;
      }
    }
    return false;
  },

  /**
   * Request key generation from smart watch
   */
  async requestKeyGeneration(data: WatchGenarteKeyData): Promise<WatchKeyPair> {
    console.log("WalletBridge", WalletBridge);
    if (Platform.OS === 'ios' && WalletBridge?.generateKeyPair) {
      try {
        console.log('[ReactNative] -> Generating key pair on smart watch with kernelAddress:', data);
        const response = await WalletBridge.generateKeyPair(data);
        console.log('[ReactNative] -> Key pair generated on smart watch:', response);
        
        // The native module returns a structured response
        if (response.success && response.data) {
          console.log('[ReactNative] -> Address:', response.data.address);
          
          return {
            address: response.data.address
          };
        } else {
          throw new Error('Failed to generate key pair: Invalid response from watch');
        }
      } catch (error) {
        console.error('Error generating key pair:', error);
        throw new Error('Failed to generate key pair on smart watch');
      }
    }
    throw new Error('Smart watch not available or not connected');
  },

  /**
   * Sync permission data to smart watch
   */
  async syncPermissionData(data: WatchPermissionData): Promise<boolean> {
    if (Platform.OS === 'ios' && WalletBridge?.syncPermissionData) {
      try {
        return await WalletBridge.syncPermissionData(data);
      } catch (error) {
        console.error('Error syncing permission data:', error);
        throw new Error('Failed to sync permission data to smart watch');
      }
    }
    throw new Error('Smart watch not available or not connected');
  },

  /**
   * Get account data from wallet
   */
  async getAccountData(): Promise<{ balance: string; address: string; history: any[] }> {
    // TODO: Replace with actual wallet data retrieval
    // This should get real data from your wallet context or service
    // You can import and use your wallet service here
    try {
      // Example: Get from wallet context or service
      // const walletData = await walletService.getAccountData();
      // return walletData;
      
      // For now, return placeholder data
      return {
        balance: "0.0",
        address: "0x0000000000000000000000000000000000000000",
        history: []
      };
    } catch (error) {
      console.error('Error getting account data:', error);
      return {
        balance: "0.0",
        address: "error",
        history: []
      };
    }
  },

  /**
   * Send any payload to the smart watch
   */
  sendToWatch(payload: Record<string, any>): void {
    if (Platform.OS === 'ios' && WalletBridge?.sendToWatch) {
      try {
        WalletBridge.sendToWatch(payload);
      } catch (error) {
        console.error('Error sending to watch:', error);
      }
    } else {
      console.warn('WalletBridge.sendToWatch is not available');
    }
  }
};

// Legacy function for backward compatibility
export function sendToWatch(payload: Record<string, any>) {
  smartWatchBridge.sendToWatch(payload);
}

// Additional utility functions for enhanced smart watch integration

/**
 * Check if the native bridge is available
 */
export function isNativeBridgeAvailable(): boolean {
  return Platform.OS === 'ios' && WalletBridge != null;
}

/**
 * Get bridge status information
 */
export function getBridgeStatus(): {
  platform: string;
  bridgeAvailable: boolean;
  watchConnected: boolean;
} {
  return {
    platform: Platform.OS,
    bridgeAvailable: isNativeBridgeAvailable(),
    watchConnected: false // This would need to be tracked in state
  };
}

/**
 * Validate watch permission data before syncing
 */
export function validatePermissionData(data: WatchPermissionData): boolean {
  return !!(
    data.permissionId &&
    data.vId &&
    data.deviceName &&
    (data.keyType === 'restricted' || data.keyType === 'sudo') &&
    data.createdAt
  );
}

/**
 * Format error messages for user display
 */
export function formatWatchError(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return 'An unknown error occurred with the smart watch';
}

