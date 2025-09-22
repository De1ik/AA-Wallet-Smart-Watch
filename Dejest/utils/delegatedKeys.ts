import AsyncStorage from '@react-native-async-storage/async-storage';

export type KeyType = 'sudo' | 'restricted';

export interface TokenLimit {
  tokenAddress: string;
  tokenSymbol: string;
  maxAmountPerDay: string;
  maxAmountPerTx: string;
}

export type InstallationStatus = 'installing' | 'completed' | 'failed';

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
