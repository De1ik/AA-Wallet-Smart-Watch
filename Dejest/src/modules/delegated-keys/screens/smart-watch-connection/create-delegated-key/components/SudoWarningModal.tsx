import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles } from '../styles';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const SudoWarningModal = ({ visible, onCancel, onConfirm }: Props) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.modalOverlay}>
      <View style={styles.warningModal}>
        <View style={styles.warningHeader}>
          <IconSymbol name="exclamationmark.triangle.fill" size={32} color="#EF4444" />
          <Text style={styles.warningTitle}>Security Warning</Text>
        </View>

        <Text style={styles.warningText}>
          Sudo access gives your smart watch complete control over your wallet, including:
        </Text>

        <View style={styles.warningList}>
          <Text style={styles.warningListItem}>• Full access to all funds</Text>
          <Text style={styles.warningListItem}>• Ability to modify wallet settings</Text>
          <Text style={styles.warningListItem}>• No spending limits or restrictions</Text>
          <Text style={styles.warningListItem}>• Risk of total fund loss if compromised</Text>
        </View>

        <Text style={styles.warningRecommendation}>
          We strongly recommend using Restricted Access instead for better security.
        </Text>

        <View style={styles.warningButtons}>
          <TouchableOpacity style={styles.warningButtonSecondary} onPress={onCancel}>
            <Text style={styles.warningButtonSecondaryText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.warningButtonPrimary} onPress={onConfirm}>
            <Text style={styles.warningButtonPrimaryText}>I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
