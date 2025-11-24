import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { styles } from '../styles';

type Props = {
  onPress: () => void;
};

export const CreateKeyButton = ({ onPress }: Props) => (
  <TouchableOpacity style={styles.createButton} onPress={onPress}>
    <IconSymbol name="plus" size={20} color="#FFFFFF" />
    <Text style={styles.createButtonText}>Create New Delegated Key</Text>
  </TouchableOpacity>
);
