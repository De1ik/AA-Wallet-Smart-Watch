import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { useWallet } from '@/modules/account/state/WalletContext';

export default function ImportWalletScreen() {
  const { importWallet } = useWallet();
  const [seedPhrase, setSeedPhrase] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImportWallet = async () => {
    try {
      const words = seedPhrase.trim().split(/\s+/).filter(word => word.length > 0);
      
      if (words.length !== 12) {
        Alert.alert('Invalid Seed Phrase', 'Please enter exactly 12 words.');
        return;
      }

      setIsImporting(true);
      await importWallet(words);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Import Failed', 'Invalid seed phrase. Please check and try again.');
      console.error('Error importing wallet:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const wordCount = seedPhrase.trim().split(/\s+/).filter(word => word.length > 0).length;

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
          <Text style={styles.title}>Import Wallet</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Content */}
          <View style={styles.mainContent}>
            <View style={styles.iconContainer}>
              <IconSymbol name="arrow.down.circle.fill" size={80} color="#8B5CF6" />
            </View>

            <Text style={styles.heading}>Import Your Wallet</Text>
            <Text style={styles.description}>
              Enter your 12-word seed phrase to restore your wallet. Make sure to enter the words in the correct order.
            </Text>

            {/* Seed Phrase Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Seed Phrase</Text>
              <TextInput
                style={styles.textInput}
                value={seedPhrase}
                onChangeText={setSeedPhrase}
                placeholder="Enter your 12-word seed phrase..."
                placeholderTextColor="#666666"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.wordCount}>
                {wordCount}/12 words
              </Text>
            </View>

            {/* Security Notice */}
            <View style={styles.securityNotice}>
              <IconSymbol name="lock.fill" size={20} color="#10B981" />
              <Text style={styles.securityText}>
                Your seed phrase is encrypted and stored securely on your device.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.importButton,
              (wordCount !== 12 || isImporting) && styles.importButtonDisabled
            ]}
            onPress={handleImportWallet}
            disabled={wordCount !== 12 || isImporting}
          >
            <Text style={styles.importButtonText}>
              {isImporting ? 'Importing...' : 'Import Wallet'}
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
  scrollContent: {
    flex: 1,
  },
  mainContent: {
    paddingBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
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
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    minHeight: 120,
  },
  wordCount: {
    fontSize: 14,
    color: '#8B5CF6',
    textAlign: 'right',
    marginTop: 8,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    gap: 12,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: '#10B981',
    lineHeight: 20,
  },
  buttonContainer: {
    paddingBottom: 40,
    paddingTop: 20,
  },
  importButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

