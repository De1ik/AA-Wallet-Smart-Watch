import AsyncStorage from '@react-native-async-storage/async-storage';

export type KeyType = 'sudo' | 'restricted' | 'callpolicy';

export interface TokenLimit {
  tokenAddress: string;
  tokenSymbol: string;
  maxAmountPerDay: string;
  maxAmountPerTx: string;
}

export interface CallPolicyPermission {
  callType: number; // 0 = CALLTYPE_SINGLE, 1 = CALLTYPE_DELEGATECALL
  target: string;
  delegatedKey: string;
  selector: string;
  rules: CallPolicyParamRule[];
  dailyUsage?: string; // Optional: Current daily usage in ETH
  // Optional metadata for UI only (not used on-chain)
  valueLimit?: string; // in ETH or token units
  dailyLimit?: string; // in ETH or token units
  decimals?: number; // Optional: token decimals for ERC20 limits
  tokenSymbol?: string; // Optional: for display when selector is ERC20 transfer
}

export interface PredefinedAction {
  id: string;
  name: string;
  description: string;
  selector: string;
  category: 'transfer' | 'approve' | 'swap' | 'stake' | 'other';
}

export interface TargetAddress {
  name: string;
  address: string;
}

export interface TokenOption {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  color?: string;
}

export interface TokenSelection extends TokenOption {
  maxValuePerTx: string;
  maxValuePerDay: string;
}

export interface CallPolicySettings {
  allowedTargets: TargetAddress[];
  allowedTokens: TokenSelection[];
  allowedActions: string[];
  maxValuePerTx: string; // in ETH
  maxValuePerDay: string; // in ETH
}

export interface CallPolicyParamRule {
  condition: number; // ParamCondition enum
  offset: number;
  params: string[];
}

export enum CallPolicyParamCondition {
  EQUAL = 0,
  GREATER_THAN = 1,
  LESS_THAN = 2,
  GREATER_THAN_OR_EQUAL = 3,
  LESS_THAN_OR_EQUAL = 4,
  NOT_EQUAL = 5,
  ONE_OF = 6
}

export type InstallationStatus = 'installing' | 'granting' | 'completed' | 'failed';

export interface DelegatedKeyData {
  id: string;
  deviceName: string;
  keyType: KeyType;
  permissionId: string;
  vId: string;
  publicAddress: string;
  createdAt: string;
  whitelistAddresses?: string[];
  tokenLimits?: TokenLimit[];
  allowEveryone?: boolean;
  callPolicyPermissions?: CallPolicyPermission[];
  installationStatus?: InstallationStatus;
  installationProgress?: {
    currentStep: string;
    totalSteps: number;
    completedSteps: number;
    transactionStatus?: string;
    currentNonce?: string;
  };
}

/**
 * Save a delegated key to AsyncStorage
 */
export const saveDelegatedKey = async (delegatedKeyData: DelegatedKeyData): Promise<void> => {
  try {
    // Get existing delegated keys
    const existingKeys = await AsyncStorage.getItem('delegatedKeys');
    const keys: DelegatedKeyData[] = existingKeys ? JSON.parse(existingKeys) : [];
    
    // Add new key
    keys.push(delegatedKeyData);
    
    // Save back to storage
    await AsyncStorage.setItem('delegatedKeys', JSON.stringify(keys));
    
    console.log('Delegated key saved successfully:', delegatedKeyData);
  } catch (error) {
    console.error('Error saving delegated key:', error);
    throw error;
  }
};

/**
 * Get all delegated keys from AsyncStorage
 */
export const getDelegatedKeys = async (): Promise<DelegatedKeyData[]> => {
  try {
    const keys = await AsyncStorage.getItem('delegatedKeys');
    return keys ? JSON.parse(keys) : [];
  } catch (error) {
    console.error('Error retrieving delegated keys:', error);
    return [];
  }
};

/**
 * Get a specific delegated key by ID
 */
export const getDelegatedKeyById = async (id: string): Promise<DelegatedKeyData | null> => {
  try {
    const keys = await getDelegatedKeys();
    return keys.find(key => key.id === id) || null;
  } catch (error) {
    console.error('Error retrieving delegated key by ID:', error);
    return null;
  }
};

/**
 * Get a specific delegated key by permission ID
 */
export const getDelegatedKeyByPermissionId = async (permissionId: string): Promise<DelegatedKeyData | null> => {
  try {
    const keys = await getDelegatedKeys();
    return keys.find(key => key.permissionId === permissionId) || null;
  } catch (error) {
    console.error('Error retrieving delegated key by permission ID:', error);
    return null;
  }
};

/**
 * Get a specific delegated key by vId
 */
export const getDelegatedKeyByVId = async (vId: string): Promise<DelegatedKeyData | null> => {
  try {
    const keys = await getDelegatedKeys();
    return keys.find(key => key.vId === vId) || null;
  } catch (error) {
    console.error('Error retrieving delegated key by vId:', error);
    return null;
  }
};

/**
 * Remove a delegated key by ID
 */
export const removeDelegatedKey = async (id: string): Promise<void> => {
  try {
    const keys = await getDelegatedKeys();
    const filteredKeys = keys.filter(key => key.id !== id);
    await AsyncStorage.setItem('delegatedKeys', JSON.stringify(filteredKeys));
    console.log('Delegated key removed successfully:', id);
  } catch (error) {
    console.error('Error removing delegated key:', error);
    throw error;
  }
};

/**
 * Remove all stuck installations (installing status)
 */
export const removeStuckInstallations = async (): Promise<void> => {
  try {
    const keys = await getDelegatedKeys();
    const filteredKeys = keys.filter(key => key.installationStatus !== 'installing');
    await AsyncStorage.setItem('delegatedKeys', JSON.stringify(filteredKeys));
    console.log('Stuck installations removed successfully');
  } catch (error) {
    console.error('Error removing stuck installations:', error);
    throw error;
  }
};

/**
 * Clear all delegated keys (for debugging/cleanup)
 */
export const clearAllDelegatedKeys = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('delegatedKeys');
    console.log('All delegated keys cleared successfully');
  } catch (error) {
    console.error('Error clearing all delegated keys:', error);
    throw error;
  }
};

/**
 * Update a delegated key
 */
export const updateDelegatedKey = async (id: string, updates: Partial<DelegatedKeyData>): Promise<void> => {
  try {
    const keys = await getDelegatedKeys();
    const keyIndex = keys.findIndex(key => key.id === id);
    
    if (keyIndex === -1) {
      throw new Error('Delegated key not found');
    }
    
    keys[keyIndex] = { ...keys[keyIndex], ...updates };
    await AsyncStorage.setItem('delegatedKeys', JSON.stringify(keys));
    console.log('Delegated key updated successfully:', id);
  } catch (error) {
    console.error('Error updating delegated key:', error);
    throw error;
  }
};
