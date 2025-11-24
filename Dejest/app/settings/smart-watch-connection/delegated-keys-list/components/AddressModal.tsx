import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { styles } from '../styles';

type Props = {
  visible: boolean;
  address: string;
  onClose: () => void;
  onCopy: () => void;
};

export const AddressModal = ({ visible, address, onClose, onCopy }: Props) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Delegated Public Key</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <IconSymbol name="xmark" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <View style={styles.fullAddressContainer}>
            <Text style={styles.fullAddressText}>{address}</Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCopyButton}
              onPress={() => {
                onCopy();
                onClose();
              }}
            >
              <IconSymbol name="doc.on.doc.fill" size={20} color="#FFFFFF" />
              <Text style={styles.copyButtonText}>Copy Public Key</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  </Modal>
);
