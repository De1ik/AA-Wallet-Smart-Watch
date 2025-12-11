import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savePrivateKey, loadPrivateKey, deletePrivateKey, saveSeedPhrase, loadSeedPhrase, deleteSeedPhrase } from '@/services/storage/secureStorage';
import { generateSeedPhrase, validateSeedPhrase, generateWalletAddress, generatePrivateKey, generateWalletAccount, getPrivateKeyFromAccount, mockCryptoData } from '@/modules/account/services/crypto';
// import { predictSmartWalletAddress } from '@/utils/walletService';
import { apiClient } from '@/services/api/apiClient';
import { clearAllDelegatedKeys } from '@/modules/delegated-keys/services/delegatedKeys';
import { getWalletAddress } from '@/modules/account/services/walletService';
import { TxStatus, TxType } from '@/domain/types';

export interface WalletData {
  address: string;
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
    type: TxType;
    from?: string;
    to?: string;
    amount: number;
    symbol: string;
    value: number;
    timestamp: Date;
    status?: TxStatus;
    errorMessage?: string;
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
  refreshCryptoData: () => Promise<void>;
  checkWalletExists: () => Promise<boolean>;
  ensureSmartWalletAddress: () => Promise<string>;
  linkKernelWallet: (address: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_STORAGE_KEY = 'wallet.dejest';

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

  const persistWallet = useCallback(
    async (publicWallet: Omit<WalletData, 'lastAccessed'> & { lastAccessed: number }) => {

      await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(publicWallet));
    },
    []
  );

  const hydrateWalletFromStorage = useCallback(async (): Promise<WalletData | null> => {
    try {
      const [storedWallet, storedPrivateKey] = await Promise.all([
        AsyncStorage.getItem(WALLET_STORAGE_KEY),
        loadPrivateKey(),
      ]);

      if (!storedWallet || !storedPrivateKey) {
        return null;
      }

      const parsedWallet = JSON.parse(storedWallet);
      const walletData: WalletData = {
        address: parsedWallet.address,
        smartWalletAddress: parsedWallet.smartWalletAddress,
        isInitialized: parsedWallet.isInitialized ?? true,
        createdAt: parsedWallet.createdAt ?? Date.now(),
        lastAccessed: Date.now(),
      };

      // if (!walletData.smartWalletAddress) {
      //   try {
      //     walletData.smartWalletAddress = await predictSmartWalletAddress(storedPrivateKey as `0x${string}`);
      //   } catch (error) {
      //     console.error('Error predicting smart wallet address:', error);
      //   }
      // }

      const publicWallet = {
        address: walletData.address,
        smartWalletAddress: walletData.smartWalletAddress,
        isInitialized: walletData.isInitialized,
        createdAt: walletData.createdAt,
        lastAccessed: walletData.lastAccessed,
      };

      await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(publicWallet));

      return walletData;
    } catch (error) {
      console.error('Error hydrating wallet from storage:', error);
      return null;
    }
  }, []);

  const fetchRealBalances = useCallback(async (address: string): Promise<CryptoData> => {
    try {
      console.log('[WalletContext] Fetching real balances for address:', address);
      
      // Use smart wallet address if available, otherwise use EOA address
      const targetAddress = address;
      const balances = await apiClient.getBalances(targetAddress);
      
      console.log('[WalletContext] Fetched balances:', balances);
      
      // Convert token balances to portfolio format (exclude ETH from tokens)
      const ethBalance = parseFloat(balances.ethBalance);
      const ethValue = ethBalance * 3500; // ETH price
      
      // Create ETH entry for portfolio
      const ethEntry = {
        id: 'ethereum',
        name: 'Ethereum',
        symbol: 'ETH',
        amount: ethBalance,
        value: ethValue,
        change24h: 0,
        color: '#627EEA',
      };
      
      // Map other tokens (excluding ETH if it appears in the list)
      const otherTokens = balances.tokens
        .filter((token) => token.symbol.toUpperCase() !== 'ETH')
        .map((token) => {
          // Parse the amount based on decimals
          const amount = parseFloat(token.amount);
          
          // Calculate USD value based on token symbol
          let value = 0;
          const symbol = token.symbol.toUpperCase();
          
          if (symbol === 'USDC' || symbol === 'USDT' || symbol === 'DAI' || symbol === 'USDCE') {
            value = amount; // Stablecoins are 1:1 with USD
          } else {
            // For other tokens, try to estimate or set to 0
            value = amount * 0;
          }
          
          // Determine change (mock data for now)
          const change24h = 0;
          
          // Generate color if not provided
          const color = token.color || '#627EEA';
          
          return {
            id: token.symbol.toLowerCase(),
            name: token.name,
            symbol: token.symbol,
            amount,
            value,
            change24h,
            color,
          };
        });
      
      // Combine ETH with other tokens
      const portfolio = [ethEntry, ...otherTokens];
      
      // Calculate total balance (sum of all token values including ETH)
      const totalBalance = portfolio.reduce((sum, token) => sum + token.value, 0);
      
      // Fetch transaction history
      const txHistory = await apiClient.getTransactions(targetAddress, 20);
      console.log('[WalletContext] Fetched transactions:', txHistory);
      
      // Format transactions for the app
      const transactions = txHistory.transactions
        .map((tx) => {
          const timestamp = new Date(tx.timestamp * 1000);
          const numericAmount = parseFloat(tx.value);
          
          // Skip zero-value transactions (unless they're important internal transactions)
          if (numericAmount === 0 && tx.eventType !== 'internal_transaction') {
            return null;
          }
          
          // Use token symbol from transaction, default to ETH
          // For NFTs, include token ID in the symbol
          let symbol = tx.tokenSymbol || 'ETH';
          if (tx.tokenId && (symbol.includes('NFT') || !tx.tokenSymbol)) {
            symbol = `${symbol} #${tx.tokenId}`;
          }
          
          // Determine transaction type using enums
          const transactionType = tx.type === TxType.RECEIVED ? TxType.RECEIVED : TxType.SENT;
          
          // Format amount to avoid scientific notation for display
          let amountForDisplay = numericAmount;
          if (numericAmount !== 0 && numericAmount < 0.0001) {
            // For very small amounts, keep precision but avoid scientific notation
            const fixedValue = numericAmount.toFixed(18);
            // Remove trailing zeros but keep up to 10 significant digits
            amountForDisplay = parseFloat(fixedValue);
          }
          
          // Calculate USD value based on token type
          let value = 0;
          const upperSymbol = symbol.toUpperCase();
          if (upperSymbol === 'ETH') {
            value = numericAmount * 3500; // ETH price
          } else if (upperSymbol === 'USDC' || upperSymbol === 'USDT' || upperSymbol === 'DAI' || upperSymbol === 'USDCE') {
            value = numericAmount; // Stablecoins are 1:1 with USD
          } else {
            value = numericAmount * 0; // Unknown tokens, would need price API
          }

          // Provide a stable ID and keep the original hash separately for details screen
          const uniqueId = `${tx.hash}-${tx.eventType || 'external'}-${tx.tokenAddress || ''}-${tx.tokenId || ''}-${tx.value}`;
          
          let status: TxStatus = TxStatus.SUCCESS;
          if (tx.status === TxStatus.FAILED) {
            status = TxStatus.FAILED;
          } else if (tx.status === TxStatus.PENDING) {
            status = TxStatus.PENDING;
          }

          return {
            id: uniqueId,
            type: transactionType,
            from: tx.from !== targetAddress ? tx.from : undefined,
            to: tx.to !== targetAddress ? tx.to : undefined,
            amount: amountForDisplay,
            symbol,
            value,
            timestamp,
            status,
            errorMessage: tx.errorMessage,
            transactionHash: tx.hash,
          };
        })
        .filter((tx): tx is NonNullable<typeof tx> => tx !== null); // Remove null entries
      
      const cryptoData: CryptoData = {
        totalBalance,
        change24h: 0, // Mock data
        portfolio,
        transactions,
      };
      
      return cryptoData;
    } catch (error) {
      console.error('[WalletContext] Error fetching real balances:', error);
      // Fallback to mock data
      return mockCryptoData;
    }
  }, []);

  const loadWallet = useCallback(async () => {
    try {
      const storedWallet = await hydrateWalletFromStorage();
      if (storedWallet) {
        setWallet(storedWallet);

        try {
          const address = storedWallet.smartWalletAddress || storedWallet.address;
          const cryptoData = await fetchRealBalances(address);
          setCryptoData(cryptoData);
        } catch (error) {
          console.error('Error fetching balances, using mock data:', error);
          setCryptoData(mockCryptoData);
        }

        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchRealBalances, hydrateWalletFromStorage]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const createWallet = async (): Promise<WalletData> => {
    try {
      const seedPhrase = generateSeedPhrase();
      console.log("seed phrase:", seedPhrase);

      const account = generateWalletAccount(seedPhrase);
      console.log("account:", account);

      // Get private key from account
      const privateKey = getPrivateKeyFromAccount(account);
      console.log("privateKey:", privateKey);

      await savePrivateKey(privateKey);
      await saveSeedPhrase(seedPhrase);
      
      // Predict smart wallet address
      let smartWalletAddress: string | undefined;
      // try {
      //   smartWalletAddress = await predictSmartWalletAddress(privateKey as `0x${string}`);
      //   console.log("PREDICTED:", smartWalletAddress)
      // } catch (error) {
      //   console.error('Error predicting smart wallet address:', error);
      // }
      
      const newWallet: WalletData = {
        address: account.address,
        smartWalletAddress,
        isInitialized: true,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
      };

      console.log('newWallet', newWallet);

      // Securely store wallet data
      await persistWallet(newWallet);
      
      setWallet(newWallet);
      setIsAuthenticated(true);
      
      // Fetch real balances
      try {
        const address = smartWalletAddress || account.address;
        const cryptoData = await fetchRealBalances(address);
        setCryptoData(cryptoData);
      } catch (error) {
        console.error('Error fetching balances for new wallet:', error);
        setCryptoData(mockCryptoData);
      }
      
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

      await savePrivateKey(privateKey);
      await saveSeedPhrase(seedPhrase);
      
      // Predict smart wallet address
      let smartWalletAddress: string | undefined;
      // try {
      //   smartWalletAddress = await predictSmartWalletAddress(privateKey as `0x${string}`);
      //   console.log('smartWalletAddress PREDICTED', smartWalletAddress);
      // } catch (error) {
      //   console.error('Error predicting smart wallet address:', error);
      // }
      
      const importedWallet: WalletData = {
        address: account.address,
        smartWalletAddress,
        isInitialized: true,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
      };

      // Securely store wallet data
      await persistWallet(importedWallet);
      
      setWallet(importedWallet);
      setIsAuthenticated(true);
      
      // Fetch real balances
      try {
        const address = smartWalletAddress || account.address;
        const cryptoData = await fetchRealBalances(address);
        setCryptoData(cryptoData);
      } catch (error) {
        console.error('Error fetching balances for imported wallet:', error);
        setCryptoData(mockCryptoData);
      }
      
      return importedWallet;
    } catch (error) {
      console.error('Error importing wallet:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear all wallet data from secure storage
      await Promise.all([
        AsyncStorage.removeItem(WALLET_STORAGE_KEY),
        deletePrivateKey(),
        deleteSeedPhrase(),
        clearAllDelegatedKeys(),
      ]);
      setWallet(null);
      setCryptoData(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const checkWalletExists = async (): Promise<boolean> => {
    try {
      const [storedWallet, storedPrivateKey] = await Promise.all([
        AsyncStorage.getItem(WALLET_STORAGE_KEY),
        loadPrivateKey(),
      ]);
      return Boolean(storedWallet && storedPrivateKey);
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

    const privateKey = await loadPrivateKey();
    if (!privateKey) {
      throw new Error('No private key found');
    }

    try {
      const smartWalletAddress = await getWalletAddress();
      
      // Update wallet with smart wallet address
      const updatedWallet = {
        ...wallet,
        smartWalletAddress,
        // Use Kernel AA as primary address for the app
        address: smartWalletAddress,
        lastAccessed: Date.now(),
      };

      await persistWallet(updatedWallet);
      setWallet(updatedWallet);

      return smartWalletAddress;
    } catch (error) {
      console.error('Error ensuring smart wallet address:', error);
      throw error;
    }
  };

  const refreshCryptoData = useCallback(async () => {
    if (!wallet) {
      setCryptoData(mockCryptoData);
      return;
    }
    
    try {
      const address = wallet.smartWalletAddress || wallet.address;
      const cryptoData = await fetchRealBalances(address);
      setCryptoData(cryptoData);
    } catch (error) {
      console.error('Error refreshing crypto data:', error);
      setCryptoData(mockCryptoData);
    }
  }, [wallet, fetchRealBalances]);

  const linkKernelWallet = async (smartAddress: string): Promise<void> => {
    if (!wallet) {
      throw new Error('No wallet found');
    }

    const updatedWallet: WalletData = {
      ...wallet,
      smartWalletAddress: smartAddress,
      address: smartAddress,      // use Kernel as the primary address in the app
      lastAccessed: Date.now(),
    };

    await persistWallet(updatedWallet);  // writes to AsyncStorage + keeps secure storage as-is
    setWallet(updatedWallet);
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
    linkKernelWallet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
