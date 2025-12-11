import React from 'react';
import { View, Text } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles } from '../styles';

export const Description = () => (
  <View style={styles.descriptionContainer}>
    <IconSymbol name="applewatch" size={48} color="#8B5CF6" />
    <Text style={styles.descriptionTitle}>Connect Your Smart Watch</Text>
    <Text style={styles.descriptionText}>
      Create delegated keys for your smart watch to enable secure, limited transactions directly from your wrist.
    </Text>
  </View>
);
