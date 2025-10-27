import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useWallet } from '@/contexts/WalletContext';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

export default function WalletScreen() {
  const { cryptoData, wallet, refreshCryptoData } = useWallet();
  const router = useRouter();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [addressType, setAddressType] = useState<'eoa' | 'smart'>('smart');

  const copyAddressToClipboard = async (address: string, type: string) => {
    try {
      await Clipboard.setStringAsync(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
      Alert.alert('Copied!', `${type} address copied to clipboard`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy address');
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

  const totalTokens = cryptoData.portfolio.length;
  const displayAddress = addressType === 'smart' && wallet.smartWalletAddress 
    ? wallet.smartWalletAddress 
    : wallet.address;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wallet</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={refreshCryptoData}
          >
            <IconSymbol name="arrow.clockwise" size={22} color="#8B5CF6" />
          </TouchableOpacity>
        </View>

        {/* Wallet Address Card */}
        <View style={styles.addressCard}>
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
        </View>

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
              <View key={transaction.id} style={styles.activityItem}>
                <View style={[
                  styles.activityIcon, 
                  { backgroundColor: transaction.type === 'receive' ? '#10B98120' : '#6B728020' }
                ]}>
                  <IconSymbol 
                    name={transaction.type === 'receive' ? "arrow.down.left" : "arrow.up.right"} 
                    size={18} 
                    color={transaction.type === 'receive' ? "#10B981" : "#6B7280"} 
                  />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>
                    {transaction.type === 'receive' 
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
                  { color: transaction.type === 'receive' ? '#10B981' : '#EF4444' }
                ]}>
                  {transaction.type === 'receive' ? '+' : '-'}{formatAmount(transaction.amount)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/send' as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#8B5CF6' }]}>
                <IconSymbol name="paperplane.fill" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>Send</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/receive' as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#10B981' }]}>
                <IconSymbol name="arrow.down.circle.fill" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>Receive</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('../portfolio' as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#F59E0B' }]}>
                <IconSymbol name="chart.pie.fill" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>Portfolio</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('../transactions' as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#6366F1' }]}>
                <IconSymbol name="list.bullet" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpace} />
      </ScrollView>
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
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
  },
  actionButton: {
    width: '47%',
    alignItems: 'center',
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  bottomSpace: {
    height: 32,
  },
});
