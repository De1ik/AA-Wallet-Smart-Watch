import { useState, useEffect, useCallback } from 'react';
import { smartWatchBridge, WatchKeyPair, WatchPermissionData, WatchGenarteKeyData } from '@/services/native/smartWatchBridge';

export interface UseSmartWatchReturn {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  requestKeyGeneration: (data: WatchGenarteKeyData) => Promise<WatchKeyPair>;
  syncPermissionData: (data: WatchPermissionData) => Promise<boolean>;
  checkConnection: () => Promise<boolean>;
  clearError: () => void;
}

export const useSmartWatch = (): UseSmartWatchReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check connection status on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const connected = await smartWatchBridge.pingWatch();
      setIsConnected(connected);
      
      return connected;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsConnected(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestKeyGeneration = useCallback(async (data: WatchGenarteKeyData): Promise<WatchKeyPair> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isConnected) {
        throw new Error('Smart watch is not connected');
      }

      console.log('[useSmartWatch] -> Calling requestKeyGeneration with data:', data);
      const keyPair = await smartWatchBridge.requestKeyGeneration(data);
      return keyPair;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate keys';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  const syncPermissionData = useCallback(async (data: WatchPermissionData): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isConnected) {
        throw new Error('Smart watch is not connected');
      }

      const success = await smartWatchBridge.syncPermissionData(data);
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync permission data';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isConnected,
    isLoading,
    error,
    requestKeyGeneration,
    syncPermissionData,
    checkConnection,
    clearError,
  };
};
