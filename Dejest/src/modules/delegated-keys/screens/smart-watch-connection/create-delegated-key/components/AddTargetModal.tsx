import React from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles } from '../styles';

type Props = {
  visible: boolean;
  newTargetName: string;
  newTargetAddress: string;
  onChangeName: (val: string) => void;
  onChangeAddress: (val: string) => void;
  onAdd: () => void;
  onClose: () => void;
};

export const AddTargetModal = ({
  visible,
  newTargetName,
  newTargetAddress,
  onChangeName,
  onChangeAddress,
  onAdd,
  onClose,
}: Props) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.targetModal}>
        <View style={styles.targetModalHeader}>
          <Text style={styles.targetModalTitle}>Add Target Address</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={20} color="#A0A0A0" />
          </TouchableOpacity>
        </View>

        <View style={styles.targetModalContent}>
          <Text style={styles.targetModalDescription}>
            Enter a name and the smart contract address your watch will be allowed to interact with.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={newTargetName}
              onChangeText={onChangeName}
              placeholder="e.g., Alisa, Uniswap, My Wallet"
              placeholderTextColor="#666666"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contract Address</Text>
            <TextInput
              style={styles.textInput}
              value={newTargetAddress}
              onChangeText={onChangeAddress}
              placeholder="0x..."
              placeholderTextColor="#666666"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.targetModalNote}>
            <IconSymbol name="info.circle" size={16} color="#8B5CF6" />
            <Text style={styles.targetModalNoteText}>
              Make sure the address is a valid smart contract on the network you're using.
            </Text>
          </View>
        </View>

        <View style={styles.targetModalButtons}>
          <TouchableOpacity style={styles.targetButtonSecondary} onPress={onClose}>
            <Text style={styles.targetButtonSecondaryText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.targetButtonPrimary} onPress={onAdd}>
            <Text style={styles.targetButtonPrimaryText}>Add Address</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
