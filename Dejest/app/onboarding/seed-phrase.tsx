import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { shouldSkipSeed } from '@/utils/config';

export default function SeedPhraseScreen() {
  const { seedPhrase } = useLocalSearchParams();
  const [isRevealed, setIsRevealed] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const words = seedPhrase ? JSON.parse(seedPhrase as string) : [];
  const skipSeed = shouldSkipSeed();

  const copyToClipboard = async (word: string, index: number) => {
    try {
      // In a real app, you would use Clipboard.setString(word)
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleContinue = () => {
    if (skipSeed) {
      // Skip verification and go directly to main app
      router.replace('/(tabs)');
    } else {
      // Normal flow: go to verification
      router.push({
        pathname: '/onboarding/verify-seed-phrase',
        params: { seedPhrase: JSON.stringify(words) }
      });
    }
  };

  const toggleReveal = () => {
    if (!isRevealed) {
      Alert.alert(
        'Security Warning',
        'Make sure you are in a private location. Never share your seed phrase with anyone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'I Understand', onPress: () => setIsRevealed(true) }
        ]
      );
    } else {
      setIsRevealed(false);
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
          <Text style={styles.title}>Your Seed Phrase</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Content */}
          <View style={styles.mainContent}>
            <View style={styles.iconContainer}>
              <IconSymbol name="key.fill" size={80} color="#8B5CF6" />
            </View>

            <Text style={styles.heading}>Write Down Your Seed Phrase</Text>
            <Text style={styles.description}>
              This is your wallet's seed phrase. Write it down on paper and store it safely. You'll need it to recover your wallet.
            </Text>

            {/* Security Warning */}
            <View style={styles.warningContainer}>
              <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#F59E0B" />
              <Text style={styles.warningText}>
                Never share your seed phrase with anyone. Anyone with access to it can control your wallet.
              </Text>
            </View>

            {/* Seed Phrase Grid */}
            <View style={styles.seedPhraseContainer}>
              <View style={styles.seedPhraseGrid}>
                {words.map((word: string, index: number) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.seedWord}
                    onPress={() => copyToClipboard(word, index)}
                  >
                    <Text style={styles.wordNumber}>{index + 1}</Text>
                    <Text style={styles.wordText}>
                      {isRevealed ? word : '••••••'}
                    </Text>
                    {copiedIndex === index && (
                      <View style={styles.copiedIndicator}>
                        <IconSymbol name="checkmark" size={16} color="#10B981" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Reveal Button */}
            <TouchableOpacity
              style={styles.revealButton}
              onPress={toggleReveal}
            >
              <IconSymbol 
                name={isRevealed ? "eye.slash.fill" : "eye.fill"} 
                size={20} 
                color="#8B5CF6" 
              />
              <Text style={styles.revealButtonText}>
                {isRevealed ? 'Hide' : 'Reveal'} Seed Phrase
              </Text>
            </TouchableOpacity>

            {/* Instructions */}
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>Important:</Text>
              <Text style={styles.instructionsText}>
                • Write down these words in the exact order shown{'\n'}
                • Store them in a safe place offline{'\n'}
                • Never share them with anyone{'\n'}
                {skipSeed ? '• Verification step will be skipped (development mode)' : '• You\'ll need them to verify in the next step'}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.continueButton, !isRevealed && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!isRevealed}
          >
            <Text style={styles.continueButtonText}>
              {skipSeed ? 'Continue' : 'I\'ve Written It Down'}
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
    marginBottom: 24,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    gap: 12,
    marginBottom: 32,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#F59E0B',
    lineHeight: 20,
  },
  seedPhraseContainer: {
    marginBottom: 24,
  },
  seedPhraseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  seedWord: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    minWidth: '30%',
    position: 'relative',
  },
  wordNumber: {
    fontSize: 12,
    color: '#8B5CF6',
    marginRight: 8,
    fontWeight: '600',
  },
  wordText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
  },
  copiedIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 24,
  },
  revealButtonText: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  instructionsContainer: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#A0A0A0',
    lineHeight: 20,
  },
  buttonContainer: {
    paddingBottom: 40,
    paddingTop: 20,
  },
  continueButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

