import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { useWallet } from '@/modules/account/state/WalletContext';
import * as Clipboard from 'expo-clipboard';
import { useNotifications } from '@/shared/contexts/NotificationContext';

export default function ReceiveScreen() {
  const { wallet } = useWallet();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const { showError, showInfo } = useNotifications();

  const copyToClipboard = async (address: string) => {
    try {
      await Clipboard.setStringAsync(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
      showInfo('Address copied to clipboard');
    } catch (error) {
      showError('Failed to copy address');
    }
  };

  const handleShare = async (address: string) => {
    try {
      await Share.share({ message: `Send funds to this address: ${address}` });
    } catch (error) {
      showError('Unable to share address');
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

  const displayAddress = wallet.smartWalletAddress || wallet.address || '';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Receive Funds</Text>
            <Text style={styles.subtitle}>Share your smart wallet address to accept payments securely</Text>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <IconSymbol name="arrow.down.to.line" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.heroTitle}>Smart wallet ready</Text>
            <Text style={styles.heroSubtitle}>
              Your address is protected by delegated keys and spending limits. Copy or share it with confidence.
            </Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaPill}>
                <IconSymbol name="lock.shield.fill" size={14} color="#8B5CF6" />
                <Text style={styles.heroMetaText}>Session keys enabled</Text>
              </View>
              <View style={styles.heroMetaPill}>
                <IconSymbol name="timelapse" size={14} color="#8B5CF6" />
                <Text style={styles.heroMetaText}>Instant status</Text>
              </View>
            </View>
          </View>

          {/* Selected Address Card */}
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <View style={styles.addressTypeBadge}>
                <IconSymbol name="wallet.pass.fill" size={20} color="#8B5CF6" />
                <Text style={styles.addressTypeLabel}>
                  Smart Wallet Address
                </Text>
              </View>
            </View>
            
            <View style={styles.addressDisplayContainer}>
              <Text style={styles.addressText}>{displayAddress}</Text>
            </View>

            <View style={styles.addressActions}>
              <TouchableOpacity
                style={[styles.primaryButton, copiedAddress === displayAddress && styles.primaryButtonSuccess]}
                onPress={() => copyToClipboard(displayAddress)}
              >
                <IconSymbol
                  name={copiedAddress === displayAddress ? 'checkmark' : 'doc.on.doc'}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.primaryButtonText}>
                  {copiedAddress === displayAddress ? 'Copied' : 'Copy address'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => handleShare(displayAddress)}>
                <IconSymbol name="square.and.arrow.up" size={16} color="#8B5CF6" />
                <Text style={styles.secondaryButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.addressInfoContainer}>
              <IconSymbol name="info.circle" size={16} color="#8B5CF6" />
              <Text style={styles.addressNote}>
                Smart wallet supports advanced features, delegated permissions, and automated policies.
              </Text>
            </View>
          </View>

          {/* Info Grid */}
          <View style={styles.infoGrid}>
            <View style={styles.infoTile}>
              <IconSymbol name="sparkles" size={18} color="#8B5CF6" />
              <Text style={styles.infoTileTitle}>Best for</Text>
              <Text style={styles.infoTileBody}>
                Delegated keys, smart automations, and ERC-4337 flows with spending controls.
              </Text>
            </View>
            <View style={styles.infoTile}>
              <IconSymbol name="bolt.fill" size={18} color="#8B5CF6" />
              <Text style={styles.infoTileTitle}>Network</Text>
              <Text style={styles.infoTileBody}>
                Ethereum Sepolia · Compatible with AA-aware dApps & wallets.
              </Text>
            </View>
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
                  <Text style={styles.instructionTitle}>Share securely</Text>
                  <Text style={styles.instructionText}>
                    Use copy or share actions above so senders paste the exact address.
                  </Text>
                </View>
              </View>

              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>3</Text>
                </View>
                <View style={styles.instructionContent}>
                  <Text style={styles.instructionTitle}>Track confirmation</Text>
                  <Text style={styles.instructionText}>
                    Monitor the dashboard for pending and confirmed transfers.
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
    marginBottom: 20,
    gap: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#A0A0A0',
  },
  heroCard: {
    backgroundColor: '#140A2A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D1444',
    marginBottom: 24,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#C4B5FD',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1E1139',
  },
  heroMetaText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '600',
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
  addressActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  primaryButtonSuccess: {
    backgroundColor: '#10B981',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    backgroundColor: '#151515',
  },
  secondaryButtonText: {
    color: '#8B5CF6',
    fontWeight: '600',
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
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  infoTile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#151022',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#241A3A',
    gap: 6,
  },
  infoTileTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoTileBody: {
    color: '#A0A0A0',
    fontSize: 13,
    lineHeight: 18,
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
