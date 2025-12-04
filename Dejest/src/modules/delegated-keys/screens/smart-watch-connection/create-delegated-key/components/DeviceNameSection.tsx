import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { styles } from '../styles';

type Props = {
  deviceName: string;
  setDeviceName: (val: string) => void;
  isWatchConnected: boolean;
};

export const DeviceNameSection = ({ deviceName, setDeviceName, isWatchConnected }: Props) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Device Name</Text>
    <TextInput
      style={[styles.input, !isWatchConnected && styles.inputDisabled]}
      placeholder={
        isWatchConnected ? 'Enter device name (e.g., Apple Watch Series 9)' : 'Connect Apple Watch first'
      }
      placeholderTextColor={isWatchConnected ? '#666666' : '#444444'}
      value={deviceName}
      onChangeText={setDeviceName}
      editable={isWatchConnected}
    />
  </View>
);
