import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { styles } from '../styles';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  highlightColor?: string;
};

export const ConfirmModal = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  highlightColor = '#EF4444',
}: Props) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.overlayCenter}>
      <View style={styles.confirmModal}>
        <View style={styles.confirmHeader}>
          <IconSymbol name="trash" size={20} color={highlightColor} />
          <Text style={styles.confirmTitle}>{title}</Text>
        </View>
        <Text style={styles.confirmMessage}>{message}</Text>
        <View style={styles.confirmActions}>
          <TouchableOpacity style={styles.confirmCancelButton} onPress={onCancel}>
            <Text style={styles.confirmCancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmConfirmButton, { borderColor: highlightColor }]}
            onPress={onConfirm}
          >
            <Text style={[styles.confirmConfirmText, { color: highlightColor }]}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
