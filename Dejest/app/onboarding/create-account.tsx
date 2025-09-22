import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useWallet } from '@/contexts/WalletContext';

export default function CreateAccountScreen() {
  const { createWallet } = useWallet();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWallet = async () => {
    try {
      setIsCreating(true);
      const wallet = await createWallet();
      router.push({
        pathname: '/onboarding/seed-phrase',
        params: { seedPhrase: JSON.stringify(wallet.seedPhrase) }
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to create wallet. Please try again.');
      console.error('Error creating wallet:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Create New Wallet</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <View style={styles.mainContent}>
          <View style={styles.iconContainer}>
            <IconSymbol name="plus.circle.fill" size={80} color="#8B5CF6" />
          </View>

          <Text style={styles.heading}>Create Your Wallet</Text>
          <Text style={styles.description}>
            We'll generate a secure seed phrase for you. Make sure to write it down and store it safely - you'll need it to access your wallet.
          </Text>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#F59E0B" />
            <Text style={styles.securityText}>
              Never share your seed phrase with anyone. Dejest will never ask for it.
            </Text>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.createButton, isCreating && styles.createButtonDisabled]}
            onPress={handleCreateWallet}
            disabled={isCreating}
          >
            <Text style={styles.createButtonText}>
              {isCreating ? 'Creating...' : 'Create Wallet'}
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
    marginBottom: 32,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#A0A0A0',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    gap: 12,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: '#F59E0B',
    lineHeight: 20,
  },
  buttonContainer: {
    paddingBottom: 40,
  },
  createButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

