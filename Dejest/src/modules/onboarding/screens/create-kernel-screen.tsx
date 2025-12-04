import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useWallet } from '@/modules/account/state/WalletContext';
import { IconSymbol } from '@/shared/ui/icon-symbol';

import { loadPrivateKey } from '@/services/storage/secureStorage';
import { Hex } from 'viem';

import { createKernelWallet } from '@/modules/kernel-factory';


export default function CreateKernelScreen() {
  const { linkKernelWallet, refreshCryptoData } = useWallet();
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false)
  const [kernelAddress, setKernelAddress] = useState<string | null>(null);

  // const { cryptoData, wallet, refreshCryptoData } = useWallet();

  const createKernel = async () => {
    try {
      setIsCreating(true);

      let privateKey = await loadPrivateKey();
      const { kernelAccount, hash } = await createKernelWallet(privateKey as Hex);

      // Update global wallet + AsyncStorage with the new Kernel address
      await linkKernelWallet(kernelAccount.address);

      // refresh balances for the new smart wallet
      // await refreshCryptoData();

      setKernelAddress(kernelAccount.address);

      setIsCreated(true)
    } catch (error) {
      console.error('Error creating kernel account:', error);
      Alert.alert('Kernel Creation Failed', 'Unable to create your account abstraction wallet. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const redirectMain = () => {
    router.replace('/(tabs)');
  }

  useEffect(() => {
    createKernel();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Create Kernel Account</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.mainContent}>
          <View style={styles.iconContainer}>
            <IconSymbol name="shield.righthalf.filled" size={80} color="#8B5CF6" />
          </View>

          <Text style={styles.heading}>Setting up your smart wallet</Text>
          <Text style={styles.description}>
            We are creating your Kernel account abstraction wallet so you can start transacting.
          </Text>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Kernel Address</Text>
            <Text style={styles.statusValue}>
              {kernelAddress ? `${kernelAddress.slice(0, 10)}...${kernelAddress.slice(-6)}` : 'Creating...'}
            </Text>
            {isCreating && <ActivityIndicator style={{ marginTop: 8 }} color="#8B5CF6" />}
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, isCreating && styles.actionButtonDisabled]}
            onPress={isCreated ? redirectMain : createKernel }
            disabled={isCreating}
          >
            <Text style={styles.actionButtonText}>
              {isCreated ? 'Go to wallet' : (isCreating ? 'Creating...' : 'Retry')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#A0A0A0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  statusCard: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 16,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  buttonContainer: {
    paddingBottom: 40,
    paddingTop: 20,
  },
  actionButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
