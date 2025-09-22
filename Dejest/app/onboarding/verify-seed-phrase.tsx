import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function VerifySeedPhraseScreen() {
  const { seedPhrase } = useLocalSearchParams();
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const correctWords = seedPhrase ? JSON.parse(seedPhrase as string) : [];

  useEffect(() => {
    // Shuffle the words for verification
    const shuffled = [...correctWords].sort(() => Math.random() - 0.5);
    setAvailableWords(shuffled);
  }, [correctWords]);

  useEffect(() => {
    // Check if all words are selected
    setIsComplete(selectedWords.length === 12);
  }, [selectedWords]);

  const handleWordSelect = (word: string) => {
    if (selectedWords.includes(word)) {
      // Remove word if already selected
      setSelectedWords(selectedWords.filter(w => w !== word));
    } else if (selectedWords.length < 12) {
      // Add word if not at limit
      setSelectedWords([...selectedWords, word]);
    }
  };

  const handleWordRemove = (index: number) => {
    const newSelectedWords = selectedWords.filter((_, i) => i !== index);
    setSelectedWords(newSelectedWords);
  };

  const verifySeedPhrase = () => {
    const isCorrect = selectedWords.every((word, index) => word === correctWords[index]);
    
    if (isCorrect) {
      Alert.alert(
        'Success!',
        'Your seed phrase has been verified. Your wallet is now ready to use.',
        [
          {
            text: 'Continue',
            onPress: () => router.replace('/(tabs)')
          }
        ]
      );
    } else {
      Alert.alert(
        'Incorrect Order',
        'The words are not in the correct order. Please try again.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setSelectedWords([]);
              // Reshuffle available words
              const shuffled = [...correctWords].sort(() => Math.random() - 0.5);
              setAvailableWords(shuffled);
            }
          }
        ]
      );
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
          <Text style={styles.title}>Verify Seed Phrase</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Content */}
          <View style={styles.mainContent}>
            <View style={styles.iconContainer}>
              <IconSymbol name="checkmark.shield.fill" size={80} color="#8B5CF6" />
            </View>

            <Text style={styles.heading}>Verify Your Seed Phrase</Text>
            <Text style={styles.description}>
              Tap the words in the correct order to verify you've written them down correctly.
            </Text>

            {/* Selected Words */}
            <View style={styles.selectedContainer}>
              <Text style={styles.selectedTitle}>Selected Words ({selectedWords.length}/12)</Text>
              <View style={styles.selectedWordsGrid}>
                {Array.from({ length: 12 }, (_, index) => (
                  <View key={index} style={styles.selectedWordSlot}>
                    {selectedWords[index] ? (
                      <TouchableOpacity
                        style={styles.selectedWord}
                        onPress={() => handleWordRemove(index)}
                      >
                        <Text style={styles.selectedWordNumber}>{index + 1}</Text>
                        <Text style={styles.selectedWordText}>{selectedWords[index]}</Text>
                        <IconSymbol name="xmark" size={12} color="#8B5CF6" />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.emptySlot}>
                        <Text style={styles.emptySlotNumber}>{index + 1}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* Available Words */}
            <View style={styles.availableContainer}>
              <Text style={styles.availableTitle}>Available Words</Text>
              <View style={styles.availableWordsGrid}>
                {availableWords
                  .filter(word => !selectedWords.includes(word))
                  .map((word, index) => (
                    <TouchableOpacity
                      key={`${word}-${index}`}
                      style={styles.availableWord}
                      onPress={() => handleWordSelect(word)}
                    >
                      <Text style={styles.availableWordText}>{word}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Action Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.verifyButton, !isComplete && styles.verifyButtonDisabled]}
            onPress={verifySeedPhrase}
            disabled={!isComplete}
          >
            <Text style={styles.verifyButtonText}>
              Verify Seed Phrase
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
  selectedContainer: {
    marginBottom: 32,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  selectedWordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedWordSlot: {
    width: '30%',
    marginBottom: 8,
  },
  selectedWord: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  selectedWordNumber: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedWordText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
  },
  emptySlot: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    borderStyle: 'dashed',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  emptySlotNumber: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
  },
  availableContainer: {
    marginBottom: 24,
  },
  availableTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  availableWordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  availableWord: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
    borderRadius: 8,
  },
  availableWordText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  buttonContainer: {
    paddingBottom: 40,
    paddingTop: 20,
  },
  verifyButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

