import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable, Animated, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { useWallet } from '@/modules/account/state/WalletContext';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { TxType } from '@/domain/types';
import { useNotifications } from '@/shared/contexts/NotificationContext';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

type QuickAction = {
  key: string;
  title: string;
  icon: string;
  color: string;
  route: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'send',
    title: 'Send',
    icon: 'paperplane.fill',
    color: '#8B5CF6',
    route: '/(tabs)/send',
  },
  {
    key: 'receive',
    title: 'Receive',
    icon: 'arrow.down.circle.fill',
    color: '#10B981',
    route: '/(tabs)/receive',
  },
  {
    key: 'portfolio',
    title: 'Portfolio',
    icon: 'chart.pie.fill',
    color: '#F59E0B',
    route: '../portfolio',
  },
  {
    key: 'history',
    title: 'History',
    icon: 'list.bullet',
    color: '#6366F1',
    route: '../transactions',
  },
];

const QuickActionButton: React.FC<{ action: QuickAction; onPress: () => void }> = ({ action, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.actionWrapper}>
      <Animated.View style={[styles.roundActionButton, { backgroundColor: action.color, transform: [{ scale }] }]}>
        <IconSymbol name={action.icon} size={24} color="#FFFFFF" />
      </Animated.View>
      <Text style={styles.roundActionLabel}>{action.title}</Text>
    </Pressable>
  );
};

export default function WalletScreen() {
  const { cryptoData, wallet, refreshCryptoData } = useWallet();
  const router = useRouter();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [addressType, setAddressType] = useState<'eoa' | 'smart'>('smart');
  const { showSuccess, showError, showInfo } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const pullDistance = useRef(new Animated.Value(0)).current;

  const copyAddressToClipboard = async (address: string, type: string) => {
    try {
      await Clipboard.setStringAsync(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
      showInfo(`${type} address copied to clipboard`);
    } catch (error) {
      showError('Failed to copy address');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatAmount = (amount: number) => {
    if (amount === 0) return '0';
    if (amount < 0.0001 && amount > 0) {
      return amount.toFixed(18).replace(/\.?0+$/, '');
    }
    return amount.toString();
  };

  if (!cryptoData || !wallet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCryptoData();
    } catch (error) {
      console.error('Error refreshing wallet data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY < 0) {
      pullDistance.setValue(Math.min(-offsetY, 120));
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

  const totalTokens = cryptoData.portfolio.length;
  const displayAddress = addressType === 'smart' && wallet.smartWalletAddress 
    ? wallet.smartWalletAddress 
    : wallet.address;

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wallet</Text>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/settings' as any)}
          >
            <Text style={styles.profileInitial}>{wallet.address.slice(2, 3).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <QuickActionButton key={action.key} action={action} onPress={() => router.push(action.route as any)} />
            ))}
          </View>
        </View>

        {/* Wallet Address Card */}
        {/* <View style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <IconSymbol name="wallet.pass" size={24} color="#8B5CF6" />
            <Text style={styles.addressCardTitle}>Wallet Address</Text>
          </View>
          
          {wallet.smartWalletAddress && (
            <View style={styles.addressToggle}>
              <TouchableOpacity 
                style={[styles.toggleButton, addressType === 'smart' && styles.toggleButtonActive]}
                onPress={() => setAddressType('smart')}
              >
                <Text style={[styles.toggleText, addressType === 'smart' && styles.toggleTextActive]}>
                  Smart Wallet
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, addressType === 'eoa' && styles.toggleButtonActive]}
                onPress={() => setAddressType('eoa')}
              >
                <Text style={[styles.toggleText, addressType === 'eoa' && styles.toggleTextActive]}>
                  EOA Wallet
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.addressContainer}
            onPress={() => {
              const type = addressType === 'smart' ? 'Smart wallet' : 'EOA';
              copyAddressToClipboard(displayAddress, type);
            }}
          >
            <Text style={styles.addressText}>{displayAddress}</Text>
            <IconSymbol 
              name={copiedAddress === displayAddress ? "checkmark.circle.fill" : "doc.on.doc"} 
              size={20} 
              color={copiedAddress === displayAddress ? "#10B981" : "#8B5CF6"} 
            />
          </TouchableOpacity>
        </View> */}

        {/* Token Balance Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.sectionTitle}>Token Balances</Text>
            <TouchableOpacity onPress={() => router.push('../portfolio' as any)}>
              <Text style={styles.viewAllText}>View All ({totalTokens})</Text>
            </TouchableOpacity>
          </View>

          {cryptoData.portfolio.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="wallet.pass" size={48} color="#6B7280" />
              <Text style={styles.emptyText}>No tokens in wallet</Text>
            </View>
          ) : (
            cryptoData.portfolio.slice(0, 3).map((crypto) => (
              <View key={crypto.id} style={styles.tokenItem}>
                <View style={styles.tokenInfo}>
                  <View style={[styles.tokenIcon, { backgroundColor: crypto.color }]}>
                    <Text style={styles.tokenIconText}>{crypto.symbol[0]}</Text>
                  </View>
                  <View style={styles.tokenDetails}>
                    <Text style={styles.tokenName}>{crypto.name}</Text>
                    <Text style={styles.tokenSymbol}>{crypto.symbol}</Text>
                  </View>
                </View>
                <View style={styles.tokenValue}>
                  <Text style={styles.tokenAmount}>
                    {formatAmount(crypto.amount)} {crypto.symbol}
                  </Text>
                  <Text style={styles.tokenValueUsd}>
                    {formatCurrency(crypto.value)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('../transactions' as any)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {cryptoData.transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="doc.text" size={48} color="#6B7280" />
              <Text style={styles.emptyText}>No recent transactions</Text>
            </View>
          ) : (
            cryptoData.transactions.slice(0, 3).map((transaction) => (
              <TouchableOpacity
                key={transaction.id}
                style={styles.activityItem}
                onPress={() =>
                  router.push({
                    pathname: '../transactions',
                    params: { transactionId: transaction.id },
                  } as any)
                }
              >
                <View style={[
                  styles.activityIcon, 
                  { backgroundColor: transaction.type === TxType.RECEIVED ? '#10B98120' : '#6B728020' }
                ]}>
                  <IconSymbol 
                    name={transaction.type === TxType.RECEIVED ? "arrow.down.left" : "arrow.up.right"} 
                    size={18} 
                    color={transaction.type === TxType.RECEIVED ? "#10B981" : "#6B7280"} 
                  />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>
                    {transaction.type === TxType.RECEIVED 
                      ? `Received ${transaction.symbol}` 
                      : `Sent ${transaction.symbol}`
                    }
                  </Text>
                  <Text style={styles.activityTime}>
                    {new Date(transaction.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[
                  styles.activityAmount,
                  { color: transaction.type === TxType.RECEIVED ? '#10B981' : '#EF4444' }
                ]}>
                  {transaction.type === TxType.RECEIVED ? '+' : '-'}{formatAmount(transaction.amount)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpace} />
      </AnimatedScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  addressCard: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  addressCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addressToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A0A0A0',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F0F0F',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'space-between',
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  summaryCard: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewAllText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0F0F0F',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tokenIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tokenIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tokenDetails: {
    flex: 1,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  tokenSymbol: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  tokenValue: {
    alignItems: 'flex-end',
  },
  tokenAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  tokenValueUsd: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A0A0A0',
  },
  activityCard: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0F0F0F',
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 13,
    color: '#A0A0A0',
  },
  activityAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    marginBottom:10
  },
  actionsHeader: {
    marginBottom: 16,
  },
  actionsHint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
  },
  actionWrapper: {
    width: '22%',
    alignItems: 'center',
  },
  roundActionButton: {
    width: 55,
    height: 55,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  roundActionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSpace: {
    height: 32,
  },
});
