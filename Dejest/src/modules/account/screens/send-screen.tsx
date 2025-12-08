import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { parseUnits, type Address } from 'viem';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { useWallet } from '@/modules/account/state/WalletContext';
import { apiClient } from '@/services/api/apiClient';
import { transactionReviewState } from '@/services/storage/transactionReviewState';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { SUPPORTED_TOKENS } from '@/shared/constants/appConstants';
import type { TokenOption } from '@/modules/delegated-keys/services/delegatedKeys';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const ETH_TOKEN: TokenOption = {
  address: '',
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
  color: '#627EEA',
};

type TokenWithAmount = TokenOption & { amount: number };

export default function SendScreen() {
  const { wallet, cryptoData, ensureSmartWalletAddress, refreshCryptoData } = useWallet();
  const { showError } = useNotifications();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState('ETH');
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenModalAnim = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false);
  const pullDistance = useRef(new Animated.Value(0)).current;

  const baseTokenCatalog = useMemo<TokenOption[]>(() => [ETH_TOKEN, ...SUPPORTED_TOKENS], []);

  const tokenOptions = useMemo<TokenWithAmount[]>(() => {
    return baseTokenCatalog.map((token) => {
      const portfolioEntry = cryptoData?.portfolio.find(
        (entry) => entry.symbol.toUpperCase() === token.symbol.toUpperCase()
      );
      return {
        ...token,
        amount: portfolioEntry?.amount ?? 0,
      };
    });
  }, [baseTokenCatalog, cryptoData?.portfolio]);

  const spendableTokens = useMemo(
    () => tokenOptions.filter((token) => token.amount > 0),
    [tokenOptions]
  );
  const hasSpendableTokens = spendableTokens.length > 0;
  const selectedTokenMeta = useMemo(
    () => tokenOptions.find((token) => token.symbol === selectedTokenSymbol),
    [tokenOptions, selectedTokenSymbol]
  );
  const selectedSpendableToken = hasSpendableTokens
    ? spendableTokens.find((token) => token.symbol === selectedTokenSymbol)
    : undefined;
  const selectedTokenColor = selectedSpendableToken?.color ?? '#8B5CF6';

  useEffect(() => {
    if (!hasSpendableTokens) {
      return;
    }
    const exists = spendableTokens.some((token) => token.symbol === selectedTokenSymbol);
    if (!exists) {
      setSelectedTokenSymbol(spendableTokens[0].symbol);
    }
  }, [hasSpendableTokens, spendableTokens, selectedTokenSymbol]);

  const handleOpenTokenSelector = () => {
    setShowTokenSelector(true);
    tokenModalAnim.setValue(0);
    Animated.timing(tokenModalAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handleCloseTokenSelector = () => {
    Animated.timing(tokenModalAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => setShowTokenSelector(false));
  };

  const handleSelectToken = (symbol: string) => {
    setSelectedTokenSymbol(symbol);
    handleCloseTokenSelector();
  };

  const modalOverlayStyle = {
    opacity: tokenModalAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  const modalContentStyle = {
    opacity: tokenModalAnim,
    transform: [
      {
        translateY: tokenModalAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [40, 0],
        }),
      },
      {
        scale: tokenModalAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.95, 1],
        }),
      },
    ],
  };

  const validateInputs = () => {
    setError(null);

    // Check if all fields are filled
    if (!recipientAddress || !amount || !selectedSpendableToken) {
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
    if (amountNum > (selectedSpendableToken.amount ?? 0)) {
      setError(`Insufficient balance. You have ${selectedSpendableToken.amount.toFixed(6)} ${selectedSpendableToken.symbol}`);
      return false;
    }

    return true;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCryptoData();
    } catch (error) {
      console.error('Error refreshing send screen data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleScroll = (event: any) => {
    const offset = event.nativeEvent.contentOffset.y;
    if (offset < 0) {
      pullDistance.setValue(Math.min(-offset, 120));
    } else {
      pullDistance.setValue(0);
    }
  };

  const indicatorHeight = pullDistance.interpolate({
    inputRange: [0, 120],
    outputRange: [0, 90],
    extrapolate: 'clamp',
  });

  const indicatorOpacity = pullDistance.interpolate({
    inputRange: [0, 20, 60],
    outputRange: [0, 0.3, 1],
    extrapolate: 'clamp',
  });

  const handleSend = async () => {
    if (!validateInputs()) {
      return;
    }

    if (!wallet) {
      setError('No wallet found. Please create or import a wallet');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const normalizedAmount = amount.replace(',', '.');
      const tokenInfo = selectedSpendableToken;
      if (!tokenInfo) {
        throw new Error('No spendable tokens available.');
      }
      const kernelAddress = wallet.smartWalletAddress || (await ensureSmartWalletAddress());
      const tokenAddress = tokenInfo.address ? tokenInfo.address : undefined;

      const response = await apiClient.sendTransaction({
        to: recipientAddress.trim(),
        amount: normalizedAmount,
        tokenAddress,
        kernelAddress,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to prepare transaction');
      }

      const decimals = tokenInfo.decimals ?? 18;
      const amountWei = parseUnits(normalizedAmount, decimals).toString();

      transactionReviewState.set({
        kind: 'account-transaction',
        payload: {
          kernelAddress: kernelAddress as Address,
          recipient: recipientAddress.trim() as Address,
          tokenAddress: tokenAddress as Address | undefined,
          tokenSymbol: tokenInfo.symbol ?? 'ETH',
          decimals,
          amountInput: normalizedAmount,
          amountWei,
          unsignedUserOp: response.data,
        },
      });

      router.push('/settings/smart-watch-connection/transaction-review');
    } catch (error: any) {
      console.error('Send transaction error:', error);
      const errorMessage = error?.message || 'Transaction failed';
      setError(errorMessage);
      showError(errorMessage, { title: 'Transaction error' });
    } finally {
      setIsLoading(false);
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
      <AnimatedScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8B5CF6"
            colors={['#8B5CF6']}
            progressBackgroundColor="#1A1A1A"
          />
        }
      >
        <Animated.View style={[styles.pullIndicator, { height: indicatorHeight, opacity: indicatorOpacity }]}>
          <ActivityIndicator size="small" color="#8B5CF6" />
        </Animated.View>
        <View style={styles.content}>
          <Text style={styles.title}>Send Crypto</Text>
          <Text style={styles.subtitle}>Transfer tokens to another wallet</Text>

          {/* Token Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Token</Text>
            <TouchableOpacity style={styles.tokenSelector} onPress={handleOpenTokenSelector}>
              <View style={styles.tokenInfo}>
                <View style={[styles.tokenIcon, { backgroundColor: selectedTokenColor }]}>
                  <Text style={styles.tokenIconText}>{selectedSpendableToken?.symbol?.[0] ?? '?'}</Text>
                </View>
                <View>
                  <Text style={styles.tokenName}>
                    {selectedSpendableToken?.symbol || 'Select token'}
                  </Text>
                  <Text style={styles.tokenMetaText}>
                    {selectedSpendableToken
                      ? `${selectedSpendableToken.amount.toFixed(4)} ${selectedSpendableToken.symbol}`
                      : 'No spendable tokens available'}
                  </Text>
                </View>
              </View>
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
              {selectedSpendableToken && <Text style={styles.tokenSymbol}>{selectedSpendableToken.symbol}</Text>}
            </View>
            <Text style={styles.balanceText}>
              {selectedSpendableToken
                ? `Balance: ${selectedSpendableToken.amount.toFixed(6)} ${selectedSpendableToken.symbol}`
                : 'Balance: —'}
            </Text>
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
      </AnimatedScrollView>

      {/* Token Selector Modal */}
      <Modal visible={showTokenSelector} transparent animationType="none" onRequestClose={handleCloseTokenSelector}>
        <View style={styles.modalRoot}>
          <TouchableWithoutFeedback onPress={handleCloseTokenSelector}>
            <Animated.View style={[styles.modalOverlay, modalOverlayStyle]} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.tokenModalContent, modalContentStyle]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Choose a token</Text>
                <Text style={styles.modalSubtitle}>Only tokens with balance can be selected</Text>
              </View>
              <TouchableOpacity onPress={handleCloseTokenSelector} style={styles.closeButton}>
                <IconSymbol name="xmark" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {hasSpendableTokens ? (
              <ScrollView contentContainerStyle={styles.tokenList}>
                {spendableTokens.map((token) => {
                  const isSelected = token.symbol === selectedTokenSymbol;
                  return (
                    <TouchableOpacity
                      key={token.symbol}
                      style={[styles.tokenCard, isSelected && styles.tokenCardSelected]}
                      onPress={() => handleSelectToken(token.symbol)}
                    >
                      <View style={styles.tokenCardLeft}>
                        <View style={[styles.tokenIconLarge, { backgroundColor: token.color ?? '#2F2F2F' }]}>
                          <Text style={styles.tokenIconText}>{token.symbol[0]}</Text>
                        </View>
                        <View>
                          <Text style={styles.tokenCardTitle}>{token.name}</Text>
                          <Text style={styles.tokenCardSubtitle}>{token.symbol}</Text>
                        </View>
                      </View>
                      <View style={styles.tokenCardRight}>
                        <Text style={styles.tokenAmountText}>
                          {token.amount.toFixed(4)} {token.symbol}
                        </Text>
                        {isSelected && <IconSymbol name="checkmark.circle.fill" size={18} color="#39b981" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptyTokenState}>
                <Text style={styles.emptyTokenTitle}>No spendable tokens</Text>
                <Text style={styles.emptyTokenSubtitle}>Deposit funds to enable sending.</Text>
              </View>
            )}
          </Animated.View>
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
  pullIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
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
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#242424',
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
  tokenMetaText: {
    fontSize: 13,
    color: '#8A8A8A',
    marginTop: 2,
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
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  tokenModalContent: {
    backgroundColor: '#0E0E0E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
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
  modalSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#1F1F1F',
  },
  tokenList: {
    gap: 12,
  },
  tokenCard: {
    backgroundColor: '#131313',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenCardSelected: {
    borderColor: '#39b981',
  },
  tokenCardDisabled: {
    opacity: 0.5,
  },
  tokenCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenIconLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  tokenCardSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  tokenCardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  tokenAmountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyTokenState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTokenTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTokenSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
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
});
