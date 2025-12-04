import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
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
  address?: string;
  addressLabel?: string;
  onCopyAddress?: (address: string) => void;
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
  address,
  addressLabel = 'Address',
  onCopyAddress,
}: Props) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.overlayCenter}>
      <View style={styles.confirmModal}>
        <View style={styles.confirmHeader}>
          <IconSymbol name="trash" size={20} color={highlightColor} />
          <Text style={styles.confirmTitle}>{title}</Text>
        </View>
        <Text style={styles.confirmMessage}>{message}</Text>
        {address ? (
          <View style={styles.confirmAddressContainer}>
            <Text style={styles.confirmAddressLabel}>{addressLabel}</Text>
            <View style={styles.confirmAddressRow}>
              <Text style={styles.confirmAddressText}>{address}</Text>
              {onCopyAddress ? (
                <TouchableOpacity
                  style={styles.confirmCopyButton}
                  onPress={() => onCopyAddress(address)}
                >
                  <IconSymbol name="doc.on.doc" size={16} color="#8B5CF6" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
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
