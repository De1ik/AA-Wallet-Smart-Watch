import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useWallet } from '@/contexts/WalletContext';

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useWallet();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // User has a wallet, navigate to main app
        router.replace('/(tabs)');
      } else {
        // No wallet found, navigate to onboarding
        router.replace('/onboarding/welcome');
      }
    }
  }, [isAuthenticated, isLoading]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.loadingText}>Loading Dejest...</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});

