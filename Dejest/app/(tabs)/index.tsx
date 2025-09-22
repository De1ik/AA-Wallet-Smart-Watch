import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useWallet } from '@/contexts/WalletContext';
import * as Clipboard from 'expo-clipboard';

export default function DashboardScreen() {
  const { cryptoData, wallet } = useWallet();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

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

  if (!cryptoData || !wallet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hour ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)} day ago`;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.welcomeText}>Welcome back, Alex</Text>
            <TouchableOpacity
              onPress={() => {
                const address = wallet?.smartWalletAddress || wallet?.address;
                const type = wallet?.smartWalletAddress ? 'Smart wallet' : 'EOA';
                if (address) copyAddressToClipboard(address, type);
              }}
              style={styles.addressContainer}
            >
              <Text style={styles.walletAddress}>
                {wallet?.smartWalletAddress 
                  ? `Smart: ${wallet.smartWalletAddress.slice(0, 6)}...${wallet.smartWalletAddress.slice(-4)}`
                  : wallet?.address 
                    ? `EOA: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
                    : ''
                }
              </Text>
              <IconSymbol 
                name={copiedAddress ? "checkmark" : "doc.on.doc"} 
                size={16} 
                color={copiedAddress ? "#10B981" : "#8B5CF6"} 
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Text style={styles.profileInitial}>A</Text>
          </TouchableOpacity>
        </View>

        {/* Total Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)}>
              <IconSymbol 
                name={balanceVisible ? "eye.fill" : "eye.slash.fill"} 
                size={20} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceAmount}>
            {balanceVisible ? formatCurrency(cryptoData.totalBalance) : '••••••'}
          </Text>
          <View style={styles.balanceChange}>
            <IconSymbol name="arrow.up.right" size={16} color="#10B981" />
            <Text style={styles.balanceChangeText}>
              +{cryptoData.change24h}% (24h)
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton}>
            <IconSymbol name="arrow.up.right" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <IconSymbol name="arrow.down.left" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Receive</Text>
          </TouchableOpacity>
        </View>

        {/* Portfolio Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {cryptoData.portfolio.map((crypto) => (
            <View key={crypto.id} style={styles.portfolioItem}>
              <View style={styles.cryptoInfo}>
                <View style={[styles.cryptoIcon, { backgroundColor: crypto.color }]}>
                  <Text style={styles.cryptoIconText}>{crypto.symbol[0]}</Text>
                </View>
                <View>
                  <Text style={styles.cryptoName}>{crypto.name}</Text>
                  <Text style={styles.cryptoAmount}>
                    {crypto.amount} {crypto.symbol}
                  </Text>
                </View>
              </View>
              <View style={styles.cryptoValue}>
                <Text style={styles.cryptoValueAmount}>
                  {formatCurrency(crypto.value)}
                </Text>
                <Text style={[
                  styles.cryptoChange,
                  { color: crypto.change24h >= 0 ? '#10B981' : '#EF4444' }
                ]}>
                  {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h}%
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Recent Activity Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {cryptoData.transactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                <IconSymbol 
                  name={transaction.type === 'receive' ? "arrow.down.left" : "arrow.up.right"} 
                  size={20} 
                  color={transaction.type === 'receive' ? "#10B981" : "#6B7280"} 
                />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle}>
                  {transaction.type === 'receive' 
                    ? `Received from ${transaction.from}` 
                    : `Sent to ${transaction.to}`
                  }
                </Text>
                <Text style={styles.transactionTime}>
                  {formatTimeAgo(transaction.timestamp)}
                </Text>
              </View>
              <View style={styles.transactionAmount}>
                <Text style={[
                  styles.transactionAmountText,
                  { color: transaction.type === 'receive' ? '#10B981' : '#EF4444' }
                ]}>
                  {transaction.type === 'receive' ? '+' : '-'}{transaction.amount} {transaction.symbol}
                </Text>
                <Text style={[
                  styles.transactionValue,
                  { color: transaction.type === 'receive' ? '#10B981' : '#EF4444' }
                ]}>
                  {transaction.type === 'receive' ? '+' : '-'}{formatCurrency(transaction.value)}
                </Text>
              </View>
            </View>
          ))}
        </View>
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
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 16,
    color: '#A0A0A0',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  walletAddress: {
    fontSize: 12,
    color: '#8B5CF6',
    fontFamily: 'monospace',
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
    fontWeight: 'bold',
  },
  balanceCard: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 24,
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#A0A0A0',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  balanceChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceChangeText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  viewAllText: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  portfolioItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  cryptoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cryptoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cryptoIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cryptoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cryptoAmount: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  cryptoValue: {
    alignItems: 'flex-end',
  },
  cryptoValueAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cryptoChange: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
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
    marginBottom: 2,
  },
  transactionValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});
