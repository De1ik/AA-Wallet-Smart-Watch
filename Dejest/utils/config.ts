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
  API_BASE_URL?: string;
}

// Get environment variables from app config
export const getAppConfig = (): AppConfig => {
  const extra = Constants.expoConfig?.extra as AppConfig;
  
  // Debug logging
  console.log('[config] -> Constants.expoConfig:', Constants.expoConfig);
  console.log('[config] -> extra:', extra);
  console.log('[config] -> KERNEL from extra:', extra?.KERNEL);
  
  return {
    PRIVATE_KEY_TEST: extra?.PRIVATE_KEY_TEST ?? false,
    PRIVATE_KEY: extra?.PRIVATE_KEY,
    KERNEL: extra?.KERNEL,
    SKIP_SEED: extra?.SKIP_SEED ?? false,
    ZERODEV_RPC: extra?.ZERODEV_RPC,
    ZERODEV_PROJECT_ID: extra?.ZERODEV_PROJECT_ID,
    PORT: extra?.PORT ?? '4000',
    API_BASE_URL: extra?.API_BASE_URL ?? 'http://localhost:4000',
  };
};

// Convenience functions for commonly used config values
export const isTestMode = (): boolean => getAppConfig().PRIVATE_KEY_TEST;
export const shouldSkipSeed = (): boolean => getAppConfig().SKIP_SEED;
export const getKernelAddress = (): string | undefined => {
  const config = getAppConfig();
  console.log('[config] -> getKernelAddress called, returning:', config.KERNEL);
  return config.KERNEL;
};
export const getPrivateKey = (): string | undefined => getAppConfig().PRIVATE_KEY;
export const getZeroDevRpc = (): string | undefined => getAppConfig().ZERODEV_RPC;
export const getZeroDevProjectId = (): string | undefined => getAppConfig().ZERODEV_PROJECT_ID;
export const getPort = (): string => getAppConfig().PORT;
export const getApiBaseUrl = (): string => getAppConfig().API_BASE_URL ?? 'http://localhost:4000';

// Export the config object for direct access
export const config = {
  API_BASE_URL: getApiBaseUrl(),
  KERNEL: getKernelAddress(),
  PRIVATE_KEY: getPrivateKey(),
  ZERODEV_RPC: getZeroDevRpc(),
  ZERODEV_PROJECT_ID: getZeroDevProjectId(),
  PORT: getPort(),
};
