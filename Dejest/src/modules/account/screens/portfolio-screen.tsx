import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { useWallet } from '@/modules/account/state/WalletContext';

export default function PortfolioScreen() {
  const router = useRouter();
  const { cryptoData, wallet, refreshCryptoData } = useWallet();
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCryptoData();
    } catch (error) {
      console.error('Error refreshing portfolio data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
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
      {/* Custom refresh indicator */}
      {refreshing && (
        <View style={styles.refreshIndicator}>
          <ActivityIndicator size="small" color="#8B5CF6" />
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Full Portfolio</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8B5CF6"
            colors={["#8B5CF6"]}
            progressBackgroundColor="#1A1A1A"
            progressViewOffset={-20}
          />
        }
      >
        {cryptoData.portfolio.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="wallet.pass" size={64} color="#6B7280" />
            <Text style={styles.emptyTitle}>No Tokens Found</Text>
            <Text style={styles.emptySubtitle}>
              Your portfolio is empty. Start by receiving tokens to your wallet.
            </Text>
          </View>
        ) : (
          cryptoData.portfolio.map((crypto) => (
            <View key={crypto.id} style={styles.portfolioItem}>
              <View style={styles.cryptoInfo}>
                <View style={[styles.cryptoIcon, { backgroundColor: crypto.color }]}>
                  <Text style={styles.cryptoIconText}>{crypto.symbol[0]}</Text>
                </View>
                <View style={styles.cryptoDetails}>
                  <Text style={styles.cryptoName}>{crypto.name}</Text>
                  <Text style={styles.cryptoSymbol}>{crypto.symbol}</Text>
                </View>
              </View>
              <View style={styles.cryptoValue}>
                <Text style={styles.cryptoAmount}>
                  {crypto.amount.toFixed(4)} {crypto.symbol}
                </Text>
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
          ))
        )}
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 20,
  },
  refreshIndicator: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    paddingTop: 10,
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
  portfolioItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  cryptoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cryptoIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cryptoIconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cryptoDetails: {
    flex: 1,
  },
  cryptoName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cryptoSymbol: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  cryptoValue: {
    alignItems: 'flex-end',
  },
  cryptoAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cryptoValueAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cryptoChange: {
    fontSize: 14,
    fontWeight: '500',
  },
});

