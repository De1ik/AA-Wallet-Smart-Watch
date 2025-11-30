import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useWallet } from '@/contexts/WalletContext';
import { apiClient } from '@/utils/api-client/apiClient';

// Token addresses on Sepolia
const TOKEN_ADDRESSES: Record<string, { address: string; decimals: number }> = {
  ETH: { address: '', decimals: 18 },
  USDT: { address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', decimals: 6 },
  USDC: { address: '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8', decimals: 6 },
  DAI: { address: '0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357', decimals: 18 },
  WETH: { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18 },
  UNI: { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
};

// Token colors
const getTokenColor = (symbol: string) => {
  const colors: Record<string, string> = {
    ETH: '#627EEA',
    USDT: '#26A17B',
    USDC: '#2775CA',
    DAI: '#F5AC37',
    WETH: '#627EEA',
    UNI: '#FF007A',
  };
  return colors[symbol] || '#8B5CF6';
};

export default function SendScreen() {
  const { wallet, cryptoData, refreshCryptoData } = useWallet();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<{ symbol: string; amount: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState('');
  const [error, setError] = useState<string | null>(null);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyAnimation = useRef(new Animated.Value(0)).current;

  // Get available tokens from portfolio (memoized to prevent new references on every render)
  const availableTokens = useMemo(() => 
    cryptoData?.portfolio.filter(token => token.amount > 0) || []
  , [cryptoData?.portfolio]);
  
  // Set default token to first available or ETH
  React.useEffect(() => {
    if (!selectedToken && availableTokens.length > 0) {
      setSelectedToken({ symbol: availableTokens[0].symbol, amount: availableTokens[0].amount });
    } else if (!selectedToken) {
      setSelectedToken({ symbol: 'ETH', amount: 0 });
    }
  }, [cryptoData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update selectedToken balance when cryptoData changes
  useEffect(() => {
    if (selectedToken && availableTokens.length > 0) {
      const token = availableTokens.find(t => t.symbol === selectedToken.symbol);
      if (token && Math.abs(token.amount - selectedToken.amount) > 0.000001) { // Use float comparison for balance updates
        setSelectedToken({ symbol: selectedToken.symbol, amount: token.amount });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cryptoData]);

  // Auto-update account state when success modal is shown
  useEffect(() => {
    if (showSuccessModal) {
      // Start periodic updates every 3 seconds
      updateIntervalRef.current = setInterval(() => {
        refreshCryptoData();
      }, 3000);

      // Cleanup on unmount or when modal closes
      return () => {
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
          updateIntervalRef.current = null;
        }
      };
    } else {
      // Clear interval when modal is closed
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuccessModal]);

  const validateInputs = () => {
    setError(null);

    // Check if all fields are filled
    if (!recipientAddress || !amount || !selectedToken) {
      setError('Please fill in all fields');
      return false;
    }

    // Validate address format
    const trimmedAddress = recipientAddress.trim();
    if (!trimmedAddress.startsWith('0x') || trimmedAddress.length !== 42) {
      setError('Invalid recipient address format');
      return false;
    }

    // Validate address characters (should be hexadecimal)
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
      setError('Invalid recipient address (contains invalid characters)');
      return false;
    }

    // Validate amount
    const normalizedAmount = amount.replace(',', '.');
    const amountNum = parseFloat(normalizedAmount);
    
    if (isNaN(amountNum)) {
      setError('Amount must be a valid number');
      return false;
    }

    if (amountNum <= 0) {
      setError('Amount must be greater than zero');
      return false;
    }

    // Check if amount exceeds balance
    if (amountNum > selectedToken.amount) {
      setError(`Insufficient balance. You have ${selectedToken.amount.toFixed(6)} ${selectedToken.symbol}`);
      return false;
    }

    return true;
  };

  const handleSend = async () => {
    // Validate inputs
    if (!validateInputs()) {
      return;
    }

    if (!wallet) {
      setError('No wallet found. Please create or import a wallet');
      return;
    }

    setIsLoading(true);
    setError(null);

    const startTime = Date.now();
    const minWaitTime = 3000; // 3 seconds minimum

    try {
      // Get token address - empty for ETH
      const normalizedAmount = amount.replace(',', '.');
      const tokenInfo = TOKEN_ADDRESSES[selectedToken!.symbol];
      const tokenAddress = tokenInfo?.address || undefined;

      // Call server-side API to send transaction
      const response = await apiClient.sendTransaction({
        to: recipientAddress.trim(),
        amount: normalizedAmount,
        tokenAddress,
      });

      // Calculate remaining time to reach minimum wait
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minWaitTime - elapsedTime);

      // Wait for minimum time before showing result
      await new Promise(resolve => setTimeout(resolve, remainingTime));

      if (response.success && response.txHash) {
        // Success - refresh data and show modal
        setTransactionHash(response.txHash);
        
        // Refresh balances and transactions after successful send
        try {
          await refreshCryptoData();
        } catch (refreshError) {
          console.error('Error refreshing data after send:', refreshError);
          // Don't fail the transaction if refresh fails
        }
        
        // Show success modal after data refresh
        setShowSuccessModal(true);
      } else {
        setError(response.error || 'Transaction failed');
      }
    } catch (error) {
      // Calculate remaining time to reach minimum wait even on error
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minWaitTime - elapsedTime);
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
      console.error('Send transaction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Transaction failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessClose = async () => {
    setShowSuccessModal(false);
    setRecipientAddress('');
    setAmount('');
    setTransactionHash('');
    setError(null);
    setCopiedField(null);
    
    // Refresh data again when modal closes (in case transaction was confirmed while modal was open)
    try {
      await refreshCryptoData();
    } catch (refreshError) {
      console.error('Error refreshing data on close:', refreshError);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedField(field);
      
      // Trigger animation
      Animated.sequence([
        Animated.timing(copyAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
        Animated.timing(copyAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCopiedField(null);
      });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (!wallet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>No Wallet Found</Text>
          <Text style={styles.subtitle}>Please create or import a wallet first</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Send Crypto</Text>
          <Text style={styles.subtitle}>Transfer tokens to another wallet</Text>

          {/* Token Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Token</Text>
            <TouchableOpacity 
              style={styles.tokenSelector}
              onPress={() => setShowTokenSelector(true)}
            >
              {selectedToken && (
                <View style={styles.tokenInfo}>
                  <View style={[styles.tokenIcon, { backgroundColor: getTokenColor(selectedToken.symbol) }]}>
                    <Text style={styles.tokenIconText}>{selectedToken.symbol[0]}</Text>
                  </View>
                  <Text style={styles.tokenName}>{selectedToken.symbol}</Text>
                </View>
              )}
              <IconSymbol name="chevron.down" size={20} color="#A0A0A0" />
            </TouchableOpacity>
          </View>


          {/* Recipient Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipient Address</Text>
            <TextInput
              style={styles.input}
              placeholder="0x..."
              placeholderTextColor="#666666"
              value={recipientAddress}
              onChangeText={(text) => {
                setRecipientAddress(text);
                setError(null); // Clear error on input
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amount</Text>
            <View style={styles.amountContainer}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#666666"
                value={amount}
                onChangeText={(text) => {
                  setAmount(text);
                  setError(null); // Clear error on input
                }}
                keyboardType="decimal-pad"
              />
              {selectedToken && <Text style={styles.tokenSymbol}>{selectedToken.symbol}</Text>}
            </View>
            {selectedToken && (
              <Text style={styles.balanceText}>
                Balance: {selectedToken.amount.toFixed(6)} {selectedToken.symbol}
              </Text>
            )}
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <IconSymbol name="exclamationmark.circle.fill" size={20} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Send Button */}
          <TouchableOpacity 
            style={[styles.sendButton, isLoading && styles.sendButtonLoading]}
            onPress={handleSend}
            disabled={isLoading}
          >
            {isLoading ? (
              <View style={styles.loadingContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.sendButtonText}>Confirming...</Text>
              </View>
            ) : (
              <>
                <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
                <Text style={styles.sendButtonText}>Send</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Token Selector Modal */}
      <Modal
        visible={showTokenSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTokenSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Token</Text>
              <TouchableOpacity onPress={() => setShowTokenSelector(false)}>
                <IconSymbol name="xmark" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {availableTokens.map((token) => (
              <TouchableOpacity 
                key={token.symbol}
                style={styles.tokenOption}
                onPress={() => {
                  setSelectedToken({ symbol: token.symbol, amount: token.amount });
                  setShowTokenSelector(false);
                }}
              >
                <View style={styles.tokenInfo}>
                  <View style={[styles.tokenIcon, { backgroundColor: getTokenColor(token.symbol) }]}>
                    <Text style={styles.tokenIconText}>{token.symbol[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.tokenName}>{token.name}</Text>
                    <Text style={styles.tokenSymbolSmall}>{token.symbol}</Text>
                  </View>
                </View>
                <Text style={styles.tokenBalance}>{token.amount.toFixed(6)} {token.symbol}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleSuccessClose}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <Text style={styles.successTitle}>Transaction Confirmed!</Text>
            <Text style={styles.successSubtitle}>Your transaction has been successfully sent</Text>

            <View style={styles.successDetails}>
              <View style={styles.successDetailRow}>
                <Text style={styles.successDetailLabel}>Token</Text>
                <Text style={styles.successDetailValue}>
                  {selectedToken?.symbol} • {parseFloat(amount).toFixed(6)}
                </Text>
              </View>

              <View style={styles.successDetailRow}>
                <Text style={styles.successDetailLabel}>Recipient</Text>
                <View style={styles.addressRow}>
                  <Text style={styles.successDetailAddress}>
                    {recipientAddress.slice(0, 10)}...{recipientAddress.slice(-8)}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => copyToClipboard(recipientAddress, 'recipient')}
                    style={styles.successCopyButton}
                  >
                    {copiedField === 'recipient' ? (
                      <IconSymbol name="checkmark.circle.fill" size={20} color="#10B981" />
                    ) : (
                      <IconSymbol name="doc.on.doc" size={16} color="#8B5CF6" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.successDetailRow}>
                <Text style={styles.successDetailLabel}>Transaction Hash</Text>
                <View style={styles.addressRow}>
                  <Text style={styles.successDetailAddress}>
                    {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => copyToClipboard(transactionHash, 'hash')}
                    style={styles.successCopyButton}
                  >
                    {copiedField === 'hash' ? (
                      <IconSymbol name="checkmark.circle.fill" size={20} color="#10B981" />
                    ) : (
                      <IconSymbol name="doc.on.doc" size={16} color="#8B5CF6" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.successButton}
              onPress={handleSuccessClose}
            >
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0A0A0',
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  tokenSelector: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#333333',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tokenSymbolSmall: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333333',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 16,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
    marginLeft: 8,
  },
  balanceText: {
    fontSize: 14,
    color: '#A0A0A0',
    marginTop: 8,
  },
  sendButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  sendButtonDisabled: {
    backgroundColor: '#4A4A4A',
  },
  sendButtonLoading: {
    backgroundColor: '#6D4BC7',
    opacity: 0.9,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tokenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tokenBalance: {
    fontSize: 16,
    fontWeight: '500',
    color: '#A0A0A0',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    flex: 1,
    fontWeight: '500',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#A0A0A0',
    marginBottom: 32,
    textAlign: 'center',
  },
  successDetails: {
    width: '100%',
    marginBottom: 24,
  },
  successDetailRow: {
    marginBottom: 20,
  },
  successDetailLabel: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 8,
    fontWeight: '500',
  },
  successDetailValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successDetailAddress: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    flex: 1,
  },
  successCopyButton: {
    padding: 4,
  },
  successButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

