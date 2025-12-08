import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { useWallet } from '@/modules/account/state/WalletContext';
import { TxStatus, TxType } from '@/domain/types';
import TransactionDetailsModal from '@/modules/account/components/TransactionDetailsModal';

export default function TransactionsScreen() {
  const router = useRouter();
  const { cryptoData, wallet } = useWallet();
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatAmount = (amount: number) => {
    // Avoid scientific notation for all amounts
    if (amount === 0) return '0';
    
    // For very small amounts, use more decimal places
    if (amount < 0.0001 && amount > 0) {
      // Use toFixed with up to 18 decimals and remove trailing zeros
      return amount.toFixed(18).replace(/\.?0+$/, '');
    }
    
    // For normal amounts, use standard formatting
    return amount.toString();
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) > 1 ? 's' : ''} ago`;
    } else if (diffInMinutes < 10080) {
      return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const openTransactionDetails = (transaction: any) => {
    setSelectedTransaction(transaction);
  };

  const closeModal = () => {
    setSelectedTransaction(null);
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {cryptoData.transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="doc.text" size={64} color="#6B7280" />
            <Text style={styles.emptyTitle}>No Transactions</Text>
            <Text style={styles.emptySubtitle}>
              Your transaction history is empty. Transactions will appear here once you start using your wallet.
            </Text>
          </View>
        ) : (
          cryptoData.transactions.map((transaction) => (
            <TouchableOpacity 
              key={transaction.id} 
              style={styles.transactionItem}
              onPress={() => openTransactionDetails(transaction)}
              activeOpacity={0.7}
            >
              <View style={styles.transactionIconContainer}>
                <View style={[
                  styles.transactionIcon, 
                  { 
                    backgroundColor: transaction.status === TxStatus.FAILED
                      ? '#EF4444' 
                      : transaction.type === TxType.RECEIVED 
                        ? '#10B981' 
                        : '#6B7280' 
                  }
                ]}>
                  <IconSymbol 
                    name={transaction.status === TxStatus.FAILED
                      ? "exclamationmark.triangle.fill"
                      : transaction.type === TxType.RECEIVED 
                        ? "arrow.down.left" 
                        : "arrow.up.right"} 
                    size={20} 
                    color="#FFFFFF" 
                  />
                </View>
              </View>
              <View style={styles.transactionInfo}>
                <View style={styles.transactionTitleRow}>
                  <Text style={styles.transactionTitle}>
                    {transaction.status === TxStatus.FAILED
                      ? `Failed ${transaction.type === TxType.RECEIVED ? 'Receipt' : 'Send'}`
                      : transaction.type === TxType.RECEIVED
                        ? `Received from ${transaction.from ? transaction.from.slice(0, 6) + '...' + transaction.from.slice(-4) : 'Unknown'}` 
                        : `Sent to ${transaction.to ? transaction.to.slice(0, 6) + '...' + transaction.to.slice(-4) : 'Unknown'}`
                    }
                  </Text>
                  {transaction.status === TxStatus.FAILED && (
                    <View style={styles.failedBadge}>
                      <Text style={styles.failedBadgeText}>Failed</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.transactionTime}>{formatTime(transaction.timestamp)}</Text>
              </View>
              <View style={styles.transactionAmount}>
                <Text style={[
                  styles.transactionAmountText,
                  { color: transaction.type === TxType.RECEIVED ? '#10B981' : '#EF4444' }
                ]}>
                  {transaction.type === TxType.RECEIVED ? '+' : '-'}{formatAmount(transaction.amount)} {transaction.symbol}
                </Text>
                <Text style={[
                  styles.transactionValue,
                  { color: transaction.type === TxType.RECEIVED ? '#10B981' : '#EF4444' }
                ]}>
                  {transaction.type === TxType.RECEIVED ? '+' : '-'}{formatCurrency(transaction.value)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TransactionDetailsModal
        visible={selectedTransaction !== null}
        transaction={selectedTransaction}
        onClose={closeModal}
      />
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#A0A0A0',
    textAlign: 'center',
    lineHeight: 24,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  transactionIconContainer: {
    marginRight: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
  },
  failedBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  failedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  transactionTime: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});
