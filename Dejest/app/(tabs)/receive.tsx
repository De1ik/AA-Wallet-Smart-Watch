import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useWallet } from '@/contexts/WalletContext';
import * as Clipboard from 'expo-clipboard';

export default function ReceiveScreen() {
  const { wallet } = useWallet();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [addressType, setAddressType] = useState<'eoa' | 'smart'>('smart');

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

  const displayAddress = addressType === 'smart' && wallet.smartWalletAddress 
    ? wallet.smartWalletAddress 
    : wallet.address;

  const hasSmartWallet = !!wallet.smartWalletAddress;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Receive Funds</Text>
              <Text style={styles.subtitle}>Share your address to receive payments</Text>
            </View>
          </View>

          {/* Address Type Toggle */}
          {hasSmartWallet && (
            <View style={styles.toggleContainer}>
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

          {/* Selected Address Card */}
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <View style={styles.addressTypeBadge}>
                <IconSymbol 
                  name={addressType === 'smart' ? "wallet.pass.fill" : "person.fill"} 
                  size={20} 
                  color="#8B5CF6" 
                />
                <Text style={styles.addressTypeLabel}>
                  {addressType === 'smart' ? 'Smart Wallet' : 'EOA'} Address
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => {
                  const type = addressType === 'smart' ? 'Smart wallet' : 'EOA';
                  copyToClipboard(displayAddress, type);
                }}
              >
                <IconSymbol 
                  name={copiedAddress === displayAddress ? "checkmark.circle.fill" : "doc.on.doc"} 
                  size={24} 
                  color={copiedAddress === displayAddress ? "#10B981" : "#8B5CF6"} 
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.addressDisplayContainer}>
              <Text style={styles.addressText}>{displayAddress}</Text>
            </View>
            
            <View style={styles.addressInfoContainer}>
              <IconSymbol name="info.circle" size={16} color="#8B5CF6" />
              <Text style={styles.addressNote}>
                {addressType === 'smart' 
                  ? 'Smart wallet supports advanced features and session keys' 
                  : 'Standard Ethereum address - simple and widely compatible'}
              </Text>
            </View>
          </View>

          {/* QR Code Placeholder */}
          <View style={styles.qrCard}>
            <View style={styles.qrCode}>
              <IconSymbol name="qrcode" size={120} color="#8B5CF6" />
            </View>
            <Text style={styles.qrText}>QR Code</Text>
            <Text style={styles.qrNote}>
              {addressType === 'smart' ? 'Smart Wallet' : 'EOA'} Address
            </Text>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <View style={styles.instructionsHeader}>
              <IconSymbol name="questionmark.circle.fill" size={24} color="#8B5CF6" />
              <Text style={styles.instructionsTitle}>How to receive crypto</Text>
            </View>
            
            <View style={styles.instructionList}>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>1</Text>
                </View>
                <View style={styles.instructionContent}>
                  <Text style={styles.instructionTitle}>Share your address</Text>
                  <Text style={styles.instructionText}>
                    Copy and share your wallet address with the sender
                  </Text>
                </View>
              </View>

              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>2</Text>
                </View>
                <View style={styles.instructionContent}>
                  <Text style={styles.instructionTitle}>Scan QR code</Text>
                  <Text style={styles.instructionText}>
                    Let the sender scan the QR code for instant transactions
                  </Text>
                </View>
              </View>

              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>3</Text>
                </View>
                <View style={styles.instructionContent}>
                  <Text style={styles.instructionTitle}>Wait for confirmation</Text>
                  <Text style={styles.instructionText}>
                    Transactions will appear in your wallet once confirmed
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Security Tips */}
          <View style={styles.securityCard}>
            <View style={styles.securityHeader}>
              <IconSymbol name="shield.fill" size={20} color="#10B981" />
              <Text style={styles.securityTitle}>Security Tips</Text>
            </View>
            <View style={styles.securityItem}>
              <IconSymbol name="checkmark.circle.fill" size={16} color="#10B981" />
              <Text style={styles.securityText}>Always verify the address before sharing</Text>
            </View>
            <View style={styles.securityItem}>
              <IconSymbol name="checkmark.circle.fill" size={16} color="#10B981" />
              <Text style={styles.securityText}>Only share your address with trusted parties</Text>
            </View>
            <View style={styles.securityItem}>
              <IconSymbol name="checkmark.circle.fill" size={16} color="#10B981" />
              <Text style={styles.securityText}>Never share your private key or seed phrase</Text>
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
  header: {
    marginBottom: 24,
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
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    backgroundColor: '#1A1A1A',
    padding: 4,
    borderRadius: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A0A0A0',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  addressCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  addressTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  copyButton: {
    padding: 8,
  },
  addressDisplayContainer: {
    backgroundColor: '#0F0F0F',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  addressInfoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  addressNote: {
    flex: 1,
    fontSize: 13,
    color: '#8B5CF6',
    lineHeight: 18,
  },
  qrCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 32,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  qrCode: {
    width: 200,
    height: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
    color: '#8B5CF6',
    fontWeight: '500',
  },
  instructionsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  instructionList: {
    gap: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  instructionNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  instructionContent: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 13,
    color: '#A0A0A0',
    lineHeight: 18,
  },
  securityCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#A0A0A0',
    lineHeight: 18,
  },
});

