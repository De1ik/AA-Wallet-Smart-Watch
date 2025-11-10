import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Type definitions for our environment variables
export interface AppConfig {
  PRIVATE_KEY_TEST: boolean;
  PRIVATE_KEY?: string;
  KERNEL?: string;
  ENTRY_POINT?: string;
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
    ENTRY_POINT: extra?.ENTRY_POINT,
    SKIP_SEED: extra?.SKIP_SEED ?? false,
    ZERODEV_RPC: extra?.ZERODEV_RPC,
    ZERODEV_PROJECT_ID: extra?.ZERODEV_PROJECT_ID,
    PORT: extra?.PORT ?? '4000',
    API_BASE_URL: extra?.API_BASE_URL,
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
export const getEntryPointAddress = (): string | undefined => {
  const config = getAppConfig();
  return config.ENTRY_POINT;
};
export const getPrivateKey = (): string | undefined => getAppConfig().PRIVATE_KEY;
export const getZeroDevRpc = (): string | undefined => getAppConfig().ZERODEV_RPC;
export const getZeroDevProjectId = (): string | undefined => getAppConfig().ZERODEV_PROJECT_ID;
export const getPort = (): string => getAppConfig().PORT;
const resolveHostFromExpo = (): string | undefined => {
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ?? (Constants as any)?.manifest?.debuggerHost;
  if (!hostUri) {
    return undefined;
  }
  return hostUri.split(':')[0];
};

const buildDefaultApiBaseUrl = (port: string): string => {
  const resolvedHost = resolveHostFromExpo();
  if (resolvedHost) {
    const normalizedHost =
      resolvedHost === 'localhost' && Platform.OS === 'android'
        ? '10.0.2.2'
        : resolvedHost;
    return `http://${normalizedHost}:${port}`;
  }
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${port}`;
  }
  return `http://localhost:${port}`;
};

export const getApiBaseUrl = (): string => {
  const cfg = getAppConfig();
  if (cfg.API_BASE_URL && cfg.API_BASE_URL.trim().length > 0) {
    return cfg.API_BASE_URL;
  }
  return buildDefaultApiBaseUrl(cfg.PORT ?? '4000');
};

// Export the config object for direct access
export const config = {
  API_BASE_URL: getApiBaseUrl(),
  KERNEL: getKernelAddress(),
  ENTRY_POINT: getEntryPointAddress(),
  PRIVATE_KEY: getPrivateKey(),
  ZERODEV_RPC: getZeroDevRpc(),
  ZERODEV_PROJECT_ID: getZeroDevProjectId(),
  PORT: getPort(),
};
