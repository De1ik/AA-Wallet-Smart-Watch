import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useWallet } from '@/contexts/WalletContext';
import * as Clipboard from 'expo-clipboard';

export default function ReceiveScreen() {
  const { wallet } = useWallet();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyToClipboard = async (address: string, type: string) => {
    try {
      await Clipboard.setStringAsync(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
      Alert.alert('Copied!', `${type} address copied to clipboard`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy address');
    }
  };

  if (!wallet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>No Wallet Found</Text>
          <Text style={styles.subtitle}>Please create or import a wallet first</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Receive Crypto</Text>
          <Text style={styles.subtitle}>Share your wallet address to receive payments</Text>

          {/* Smart Wallet Address */}
          {wallet.smartWalletAddress && (
            <View style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <IconSymbol name="wallet.fill" size={24} color="#8B5CF6" />
                <Text style={styles.addressType}>Smart Wallet Address</Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyToClipboard(wallet.smartWalletAddress!, 'Smart wallet')}
                >
                  <IconSymbol 
                    name={copiedAddress === wallet.smartWalletAddress ? "checkmark" : "doc.on.doc"} 
                    size={20} 
                    color={copiedAddress === wallet.smartWalletAddress ? "#10B981" : "#8B5CF6"} 
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.addressText}>{wallet.smartWalletAddress}</Text>
              <Text style={styles.addressNote}>Recommended for smart wallet transactions</Text>
            </View>
          )}

          {/* EOA Address */}
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <IconSymbol name="person.fill" size={24} color="#8B5CF6" />
              <Text style={styles.addressType}>EOA Address</Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyToClipboard(wallet.address, 'EOA')}
              >
                <IconSymbol 
                  name={copiedAddress === wallet.address ? "checkmark" : "doc.on.doc"} 
                  size={20} 
                  color={copiedAddress === wallet.address ? "#10B981" : "#8B5CF6"} 
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.addressText}>{wallet.address}</Text>
            <Text style={styles.addressNote}>Standard Ethereum address</Text>
          </View>

          {/* QR Code Placeholder */}
          <View style={styles.qrCard}>
            <View style={styles.qrCode}>
              <IconSymbol name="qrcode" size={120} color="#8B5CF6" />
            </View>
            <Text style={styles.qrText}>QR Code</Text>
            <Text style={styles.qrNote}>
              {wallet.smartWalletAddress ? 'Smart Wallet' : 'EOA'} Address
            </Text>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>How to receive crypto:</Text>
            <View style={styles.instructionItem}>
              <IconSymbol name="1.circle.fill" size={20} color="#8B5CF6" />
              <Text style={styles.instructionText}>Share your wallet address with the sender</Text>
            </View>
            <View style={styles.instructionItem}>
              <IconSymbol name="2.circle.fill" size={20} color="#8B5CF6" />
              <Text style={styles.instructionText}>Use the QR code for easy scanning</Text>
            </View>
            <View style={styles.instructionItem}>
              <IconSymbol name="3.circle.fill" size={20} color="#8B5CF6" />
              <Text style={styles.instructionText}>Wait for the transaction to be confirmed</Text>
            </View>
          </View>
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
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0A0A0',
    marginBottom: 32,
  },
  addressCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  addressType: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  copyButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
  },
  addressText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    marginBottom: 8,
    lineHeight: 20,
  },
  addressNote: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  qrCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  qrCode: {
    width: 160,
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  qrNote: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  instructionsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#A0A0A0',
    lineHeight: 20,
  },
});

