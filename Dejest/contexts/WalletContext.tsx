import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSeedPhrase, validateSeedPhrase, generateWalletAddress, generatePrivateKey, generateWalletAccount, getPrivateKeyFromAccount, mockCryptoData } from '@/utils/crypto';
import { predictSmartWalletAddress } from '@/utils/walletService';

export interface WalletData {
  seedPhrase: string[];
  address: string;
  privateKey: string;
  smartWalletAddress?: string;
  isInitialized: boolean;
  createdAt: number;
  lastAccessed: number;
}

export interface CryptoData {
  totalBalance: number;
  change24h: number;
  portfolio: Array<{
    id: string;
    name: string;
    symbol: string;
    amount: number;
    value: number;
    change24h: number;
    color: string;
  }>;
  transactions: Array<{
    id: string;
    type: 'send' | 'receive';
    from?: string;
    to?: string;
    amount: number;
    symbol: string;
    value: number;
    timestamp: Date;
  }>;
}

interface WalletContextType {
  wallet: WalletData | null;
  cryptoData: CryptoData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  createWallet: () => Promise<WalletData>;
  importWallet: (seedPhrase: string[]) => Promise<WalletData>;
  logout: () => Promise<void>;
  refreshCryptoData: () => void;
  checkWalletExists: () => Promise<boolean>;
  ensureSmartWalletAddress: () => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [cryptoData, setCryptoData] = useState<CryptoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const storedWallet = await AsyncStorage.getItem('wallet');
      if (storedWallet) {
        const parsedWallet = JSON.parse(storedWallet);
        
        // Ensure smart wallet address exists
        let updatedWallet = { ...parsedWallet };
        if (!updatedWallet.smartWalletAddress && updatedWallet.privateKey) {
          try {
            const smartWalletAddress = await predictSmartWalletAddress(updatedWallet.privateKey as `0x${string}`);
            updatedWallet.smartWalletAddress = smartWalletAddress;
          } catch (error) {
            console.error('Error predicting smart wallet address:', error);
          }
        }
        
        // Update last accessed time
        updatedWallet.lastAccessed = Date.now();
        
        // Save updated wallet data
        await AsyncStorage.setItem('wallet', JSON.stringify(updatedWallet));
        
        setWallet(updatedWallet);
        setCryptoData(mockCryptoData);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createWallet = async (): Promise<WalletData> => {
    try {
      const seedPhrase = generateSeedPhrase();
      const account = generateWalletAccount(seedPhrase);
      
      // Get private key from account
      const privateKey = getPrivateKeyFromAccount(account);
      
      // Predict smart wallet address
      let smartWalletAddress: string | undefined;
      try {
        smartWalletAddress = await predictSmartWalletAddress(privateKey as `0x${string}`);
      } catch (error) {
        console.error('Error predicting smart wallet address:', error);
      }
      
      const newWallet: WalletData = {
        seedPhrase,
        address: account.address,
        privateKey,
        smartWalletAddress,
        isInitialized: true,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
      };

      console.log('newWallet', newWallet);

      // Securely store wallet data
      await AsyncStorage.setItem('wallet', JSON.stringify(newWallet));
      
      setWallet(newWallet);
      setCryptoData(mockCryptoData);
      setIsAuthenticated(true);
      
      return newWallet;
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw error;
    }
  };

  const importWallet = async (seedPhrase: string[]): Promise<WalletData> => {
    try {
      if (!validateSeedPhrase(seedPhrase)) {
        throw new Error('Invalid seed phrase');
      }

      const account = generateWalletAccount(seedPhrase);
      
      // Get private key from account
      const privateKey = getPrivateKeyFromAccount(account);
      
      // Predict smart wallet address
      let smartWalletAddress: string | undefined;
      try {
        smartWalletAddress = await predictSmartWalletAddress(privateKey as `0x${string}`);
        console.log('smartWalletAddress', smartWalletAddress);
      } catch (error) {
        console.error('Error predicting smart wallet address:', error);
      }
      
      const importedWallet: WalletData = {
        seedPhrase,
        address: account.address,
        privateKey,
        smartWalletAddress,
        isInitialized: true,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
      };

      // Securely store wallet data
      await AsyncStorage.setItem('wallet', JSON.stringify(importedWallet));
      
      setWallet(importedWallet);
      setCryptoData(mockCryptoData);
      setIsAuthenticated(true);
      
      return importedWallet;
    } catch (error) {
      console.error('Error importing wallet:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear all wallet data from secure storage
      await AsyncStorage.removeItem('wallet');
      setWallet(null);
      setCryptoData(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const checkWalletExists = async (): Promise<boolean> => {
    try {
      const storedWallet = await AsyncStorage.getItem('wallet');
      return storedWallet !== null;
    } catch (error) {
      console.error('Error checking wallet existence:', error);
      return false;
    }
  };

  const ensureSmartWalletAddress = async (): Promise<string> => {
    if (!wallet) {
      throw new Error('No wallet found');
    }

    if (wallet.smartWalletAddress) {
      return wallet.smartWalletAddress;
    }

    try {
      const smartWalletAddress = await predictSmartWalletAddress(wallet.privateKey as `0x${string}`);
      
      // Update wallet with smart wallet address
      const updatedWallet = {
        ...wallet,
        smartWalletAddress,
        lastAccessed: Date.now(),
      };

      await AsyncStorage.setItem('wallet', JSON.stringify(updatedWallet));
      setWallet(updatedWallet);

      return smartWalletAddress;
    } catch (error) {
      console.error('Error ensuring smart wallet address:', error);
      throw error;
    }
  };

  const refreshCryptoData = () => {
    // In a real app, this would fetch fresh data from an API
    setCryptoData(mockCryptoData);
  };

  const value: WalletContextType = {
    wallet,
    cryptoData,
    isLoading,
    isAuthenticated,
    createWallet,
    importWallet,
    logout,
    refreshCryptoData,
    checkWalletExists,
    ensureSmartWalletAddress,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
