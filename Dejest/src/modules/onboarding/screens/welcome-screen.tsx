import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { Colors } from '@/shared/constants/theme';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Icon */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <IconSymbol name="wallet.fill" size={80} color="#8B5CF6" />
          </View>
          <Text style={styles.appName}>Dejest</Text>
          <Text style={styles.tagline}>Your Secure Crypto Wallet</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <IconSymbol name="shield.fill" size={24} color="#8B5CF6" />
            <Text style={styles.featureText}>Secure & Private</Text>
          </View>
          <View style={styles.feature}>
            <IconSymbol name="bolt.fill" size={24} color="#8B5CF6" />
            <Text style={styles.featureText}>Fast Transactions</Text>
          </View>
          <View style={styles.feature}>
            <IconSymbol name="globe" size={24} color="#8B5CF6" />
            <Text style={styles.featureText}>Multi-Chain Support</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/onboarding/create-account')}
          >
            <Text style={styles.primaryButtonText}>Create New Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/onboarding/import-wallet')}
          >
            <Text style={styles.secondaryButtonText}>Import Existing Wallet</Text>
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
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#A0A0A0',
    textAlign: 'center',
  },
  featuresContainer: {
    alignItems: 'center',
    gap: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  secondaryButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
});

