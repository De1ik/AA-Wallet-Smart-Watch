import Constants from 'expo-constants';

// Type definitions for our environment variables
export interface AppConfig {
  PRIVATE_KEY_TEST: boolean;
  PRIVATE_KEY?: string;
  KERNEL?: string;
  SKIP_SEED: boolean;
  ZERODEV_RPC?: string;
  ZERODEV_PROJECT_ID?: string;
  PORT: string;
}

// Get environment variables from app config
export const getAppConfig = (): AppConfig => {
  const extra = Constants.expoConfig?.extra as AppConfig;
  
  return {
    PRIVATE_KEY_TEST: extra?.PRIVATE_KEY_TEST ?? false,
    PRIVATE_KEY: extra?.PRIVATE_KEY,
    KERNEL: extra?.KERNEL,
    SKIP_SEED: extra?.SKIP_SEED ?? false,
    ZERODEV_RPC: extra?.ZERODEV_RPC,
    ZERODEV_PROJECT_ID: extra?.ZERODEV_PROJECT_ID,
    PORT: extra?.PORT ?? '4000',
  };
};

// Convenience functions for commonly used config values
export const isTestMode = (): boolean => getAppConfig().PRIVATE_KEY_TEST;
export const shouldSkipSeed = (): boolean => getAppConfig().SKIP_SEED;
export const getKernelAddress = (): string | undefined => getAppConfig().KERNEL;
export const getPrivateKey = (): string | undefined => getAppConfig().PRIVATE_KEY;
export const getZeroDevRpc = (): string | undefined => getAppConfig().ZERODEV_RPC;
export const getZeroDevProjectId = (): string | undefined => getAppConfig().ZERODEV_PROJECT_ID;
export const getPort = (): string => getAppConfig().PORT;
