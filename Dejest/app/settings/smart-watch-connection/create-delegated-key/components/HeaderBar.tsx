import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { styles } from '../styles';

export const HeaderBar = () => (
  <>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.title}>Create Delegated Key</Text>
      <View style={styles.placeholder} />
    </View>
  </>
);
