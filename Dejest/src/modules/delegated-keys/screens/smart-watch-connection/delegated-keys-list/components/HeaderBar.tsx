import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles } from '../styles';

export const HeaderBar = () => (
  <View style={styles.header}>
    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
      <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
    </TouchableOpacity>
    <Text style={styles.title}>Smart Watch Connection</Text>
    <View style={styles.placeholder} />
  </View>
);
