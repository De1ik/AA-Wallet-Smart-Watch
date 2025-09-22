import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useWallet } from '@/contexts/WalletContext';
import { sendTransaction } from '@/utils/walletService';
import { parseEther, formatEther } from 'viem';

export default function SendScreen() {
  const { wallet, cryptoData } = useWallet();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<'ETH' | 'USDT'>('ETH');
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);

  const handleSend = async () => {
    if (!recipientAddress || !amount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!wallet) {
      Alert.alert('Error', 'No wallet found');
      return;
    }

    // Basic address validation
    if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 42) {
      Alert.alert('Error', 'Invalid recipient address');
      return;
    }

    // Basic amount validation - handle both comma and dot decimal separators
    const normalizedAmount = amount.replace(',', '.'); // Convert comma to dot for parsing
    const amountNum = parseFloat(normalizedAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Invalid amount');
      return;
    }

    setIsLoading(true);

    try {
      let tokenAddress: `0x${string}` | undefined;

      if (selectedToken === 'USDT') {
        // USDT contract address on Sepolia (example)
        tokenAddress = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06' as `0x${string}`;
      }

      const txHash = await sendTransaction({
        to: recipientAddress as `0x${string}`,
        amount: normalizedAmount, // Amount as string in ETH (normalized to use dot)
        tokenAddress,
      });

      Alert.alert(
        'Success!', 
        `Transaction sent successfully!\n\nTransaction Hash: ${txHash.slice(0, 10)}...`,
        [
          {
            text: 'OK',
            onPress: () => {
              setRecipientAddress('');
              setAmount('');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Send transaction error:', error);
      Alert.alert('Error', `Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
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
          <Text style={styles.title}>Send Crypto</Text>
          <Text style={styles.subtitle}>Transfer tokens to another wallet</Text>

          {/* Token Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Token</Text>
            <TouchableOpacity 
              style={styles.tokenSelector}
              onPress={() => setShowTokenSelector(true)}
            >
              <View style={styles.tokenInfo}>
                <View style={[styles.tokenIcon, { backgroundColor: selectedToken === 'ETH' ? '#627EEA' : '#26A17B' }]}>
                  <Text style={styles.tokenIconText}>{selectedToken[0]}</Text>
                </View>
                <Text style={styles.tokenName}>{selectedToken}</Text>
              </View>
              <IconSymbol name="chevron.down" size={20} color="#A0A0A0" />
            </TouchableOpacity>
          </View>

          {/* Recipient Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipient Address</Text>
            <TextInput
              style={styles.input}
              placeholder="0x..."
              placeholderTextColor="#666666"
              value={recipientAddress}
              onChangeText={setRecipientAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amount</Text>
            <View style={styles.amountContainer}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#666666"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <Text style={styles.tokenSymbol}>{selectedToken}</Text>
            </View>
            {cryptoData && (
              <Text style={styles.balanceText}>
                Balance: {selectedToken === 'ETH' ? '0.5' : '1000.0'} {selectedToken}
              </Text>
            )}
          </View>

          {/* Send Button */}
          <TouchableOpacity 
            style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={styles.sendButtonText}>Sending...</Text>
            ) : (
              <>
                <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
                <Text style={styles.sendButtonText}>Send</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Token Selector Modal */}
      <Modal
        visible={showTokenSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTokenSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Token</Text>
              <TouchableOpacity onPress={() => setShowTokenSelector(false)}>
                <IconSymbol name="xmark" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.tokenOption}
              onPress={() => {
                setSelectedToken('ETH');
                setShowTokenSelector(false);
              }}
            >
              <View style={styles.tokenInfo}>
                <View style={[styles.tokenIcon, { backgroundColor: '#627EEA' }]}>
                  <Text style={styles.tokenIconText}>E</Text>
                </View>
                <View>
                  <Text style={styles.tokenName}>Ethereum</Text>
                  <Text style={styles.tokenSymbol}>ETH</Text>
                </View>
              </View>
              <Text style={styles.tokenBalance}>0.5 ETH</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.tokenOption}
              onPress={() => {
                setSelectedToken('USDT');
                setShowTokenSelector(false);
              }}
            >
              <View style={styles.tokenInfo}>
                <View style={[styles.tokenIcon, { backgroundColor: '#26A17B' }]}>
                  <Text style={styles.tokenIconText}>U</Text>
                </View>
                <View>
                  <Text style={styles.tokenName}>Tether USD</Text>
                  <Text style={styles.tokenSymbol}>USDT</Text>
                </View>
              </View>
              <Text style={styles.tokenBalance}>1000.0 USDT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  tokenSelector: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#333333',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333333',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 16,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
    marginLeft: 8,
  },
  balanceText: {
    fontSize: 14,
    color: '#A0A0A0',
    marginTop: 8,
  },
  sendButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  sendButtonDisabled: {
    backgroundColor: '#4A4A4A',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tokenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tokenBalance: {
    fontSize: 16,
    fontWeight: '500',
    color: '#A0A0A0',
  },
});

