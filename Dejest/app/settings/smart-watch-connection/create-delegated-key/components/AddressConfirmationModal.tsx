import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { styles } from '../styles';
import { WatchKeyPair } from '@/utils/smartWatchBridge';

type Props = {
  visible: boolean;
  pendingKeyPair: WatchKeyPair | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export const AddressConfirmationModal = ({ visible, pendingKeyPair, onConfirm, onCancel }: Props) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.modalOverlay}>
      <View style={styles.confirmationModal}>
        <View style={styles.confirmationHeader}>
          <IconSymbol name="checkmark.shield.fill" size={32} color="#10B981" />
          <Text style={styles.confirmationTitle}>Confirm Address</Text>
        </View>

        <Text style={styles.confirmationText}>
          Your Apple Watch has generated a new address. Please verify that the address shown below matches exactly what you
          see on your Apple Watch screen.
        </Text>

        {pendingKeyPair && (
          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>Generated Address:</Text>
            <View style={styles.addressDisplay}>
              <Text style={styles.confirmationAddressText} numberOfLines={0}>
                {pendingKeyPair.address}
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={async () => {
                  if (pendingKeyPair?.address) {
                    await Clipboard.setStringAsync(pendingKeyPair.address);
                  }
                }}
              >
                <IconSymbol name="doc.on.doc" size={16} color="#8B5CF6" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.confirmationWarning}>
          ⚠️ Only proceed if the address matches exactly what you see on your Apple Watch. This is a critical security step.
        </Text>

        <View style={styles.confirmationButtons}>
          <TouchableOpacity style={styles.confirmationButtonSecondary} onPress={onCancel}>
            <Text style={styles.confirmationButtonSecondaryText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmationButtonPrimary} onPress={onConfirm}>
            <Text style={styles.confirmationButtonPrimaryText}>Address Matches</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
