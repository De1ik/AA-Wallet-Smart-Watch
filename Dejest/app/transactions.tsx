import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useWallet } from '@/contexts/WalletContext';

export default function TransactionsScreen() {
  const router = useRouter();
  const { cryptoData, wallet } = useWallet();
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const openTransactionDetails = (transaction: any) => {
    setSelectedTransaction(transaction);
  };

  const closeModal = () => {
    setSelectedTransaction(null);
    setCopiedField(null);
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
                    backgroundColor: transaction.status === 'failed' 
                      ? '#EF4444' 
                      : transaction.type === 'receive' 
                        ? '#10B981' 
                        : '#6B7280' 
                  }
                ]}>
                  <IconSymbol 
                    name={transaction.status === 'failed' 
                      ? "exclamationmark.triangle.fill"
                      : transaction.type === 'receive' 
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
                    {transaction.status === 'failed' 
                      ? `Failed ${transaction.type === 'receive' ? 'Receipt' : 'Send'}`
                      : transaction.type === 'receive' 
                        ? `Received from ${transaction.from ? transaction.from.slice(0, 6) + '...' + transaction.from.slice(-4) : 'Unknown'}` 
                        : `Sent to ${transaction.to ? transaction.to.slice(0, 6) + '...' + transaction.to.slice(-4) : 'Unknown'}`
                    }
                  </Text>
                  {transaction.status === 'failed' && (
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
                  { color: transaction.type === 'receive' ? '#10B981' : '#EF4444' }
                ]}>
                  {transaction.type === 'receive' ? '+' : '-'}{formatAmount(transaction.amount)} {transaction.symbol}
                </Text>
                <Text style={[
                  styles.transactionValue,
                  { color: transaction.type === 'receive' ? '#10B981' : '#EF4444' }
                ]}>
                  {transaction.type === 'receive' ? '+' : '-'}{formatCurrency(transaction.value)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Transaction Details Modal */}
      <Modal
        visible={selectedTransaction !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction Details</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <IconSymbol name="xmark" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {selectedTransaction && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={[styles.detailValue, { 
                      color: selectedTransaction.type === 'receive' ? '#10B981' : '#EF4444' 
                    }]}>
                      {selectedTransaction.type === 'receive' ? 'Received' : 'Sent'}
                    </Text>
                  </View>

                  {selectedTransaction.status && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status</Text>
                      <View style={styles.statusContainer}>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: selectedTransaction.status === 'failed' ? '#EF444420' : selectedTransaction.status === 'success' ? '#10B98120' : '#F59E0B20' }
                        ]}>
                          <Text style={[
                            styles.statusText,
                            { color: selectedTransaction.status === 'failed' ? '#EF4444' : selectedTransaction.status === 'success' ? '#10B981' : '#F59E0B' }
                          ]}>
                            {selectedTransaction.status === 'failed' ? 'Failed' : selectedTransaction.status === 'success' ? 'Success' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {selectedTransaction.errorMessage && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Error</Text>
                      <Text style={[styles.detailValue, { color: '#EF4444' }]}>
                        {selectedTransaction.errorMessage}
                      </Text>
                    </View>
                  )}

                  {selectedTransaction.from && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>From</Text>
                      <View style={styles.addressContainer}>
                        <Text style={styles.detailAddress}>{selectedTransaction.from}</Text>
                        <TouchableOpacity 
                          onPress={() => copyToClipboard(selectedTransaction.from, 'from')}
                          style={styles.copyButton}
                        >
                          <IconSymbol 
                            name={copiedField === 'from' ? "checkmark.circle" : "doc.on.doc"} 
                            size={20} 
                            color={copiedField === 'from' ? "#10B981" : "#8B5CF6"} 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {selectedTransaction.to && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>To</Text>
                      <View style={styles.addressContainer}>
                        <Text style={styles.detailAddress}>{selectedTransaction.to}</Text>
                        <TouchableOpacity 
                          onPress={() => copyToClipboard(selectedTransaction.to, 'to')}
                          style={styles.copyButton}
                        >
                          <IconSymbol 
                            name={copiedField === 'to' ? "checkmark.circle" : "doc.on.doc"} 
                            size={20} 
                            color={copiedField === 'to' ? "#10B981" : "#8B5CF6"} 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Amount</Text>
                    <Text style={[styles.detailValue, { 
                      color: selectedTransaction.type === 'receive' ? '#10B981' : '#EF4444' 
                    }]}>
                      {selectedTransaction.type === 'receive' ? '+' : '-'}{formatAmount(selectedTransaction.amount)} {selectedTransaction.symbol}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Value</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.type === 'receive' ? '+' : '-'}{formatCurrency(selectedTransaction.value)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Timestamp</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.timestamp.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Transaction ID</Text>
                    <View style={styles.addressContainer}>
                      <Text style={styles.detailAddress}>{selectedTransaction.id}</Text>
                      <TouchableOpacity 
                        onPress={() => copyToClipboard(selectedTransaction.id, 'hash')}
                        style={styles.copyButton}
                      >
                        <IconSymbol 
                          name={copiedField === 'hash' ? "checkmark.circle" : "doc.on.doc"} 
                          size={20} 
                          color={copiedField === 'hash' ? "#10B981" : "#8B5CF6"} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  detailRow: {
    marginBottom: 24,
  },
  detailLabel: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 8,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  detailAddress: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    flex: 1,
    paddingRight: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  copyButton: {
    padding: 4,
  },
  statusContainer: {
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

