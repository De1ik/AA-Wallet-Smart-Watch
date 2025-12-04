import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles } from '../styles';
import { TransferOptions } from '../callPolicyBuilders';

type Props = {
  visible: boolean;
  transferOptions: TransferOptions;
  setTransferOptions: React.Dispatch<React.SetStateAction<TransferOptions>>;
  onClose: () => void;
  onConfirm: () => void;
};

export const TransferOptionsModal = ({ visible, transferOptions, setTransferOptions, onClose, onConfirm }: Props) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.transferModal}>
        <View style={styles.transferModalHeader}>
          <Text style={styles.transferModalTitle}>Transfer Options</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={20} color="#666666" />
          </TouchableOpacity>
        </View>

        <View style={styles.transferOptionsContainer}>
          <Text style={styles.transferOptionsDescription}>Choose what types of transfers this delegated key can perform:</Text>

          <TouchableOpacity
            style={[styles.transferOption, transferOptions.eth && styles.transferOptionSelected]}
            onPress={() => {
              if (transferOptions.eth && !transferOptions.erc20) return;
              setTransferOptions((prev) => ({ ...prev, eth: !prev.eth }));
            }}
          >
            <View style={styles.transferOptionContent}>
              <IconSymbol name="bitcoinsign.circle.fill" size={24} color={transferOptions.eth ? '#10B981' : '#666666'} />
              <View style={styles.transferOptionText}>
                <Text style={[styles.transferOptionTitle, transferOptions.eth && styles.transferOptionTitleSelected]}>
                  ETH Transfers
                </Text>
                <Text style={styles.transferOptionDescription}>Send native ETH to any address</Text>
              </View>
              <View style={[styles.checkbox, transferOptions.eth && styles.checkboxSelected]}>
                {transferOptions.eth && <IconSymbol name="checkmark" size={16} color="#FFFFFF" />}
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.transferOption, transferOptions.erc20 && styles.transferOptionSelected]}
            onPress={() => {
              if (transferOptions.erc20 && !transferOptions.eth) return;
              setTransferOptions((prev) => ({ ...prev, erc20: !prev.erc20 }));
            }}
          >
            <View style={styles.transferOptionContent}>
              <IconSymbol
                name="dollarsign.circle.fill"
                size={24}
                color={transferOptions.erc20 ? '#10B981' : '#666666'}
              />
              <View style={styles.transferOptionText}>
                <Text
                  style={[styles.transferOptionTitle, transferOptions.erc20 && styles.transferOptionTitleSelected]}
                >
                  ERC20 Token Transfers
                </Text>
                <Text style={styles.transferOptionDescription}>Send ERC20 tokens to any address</Text>
              </View>
              <View style={[styles.checkbox, transferOptions.erc20 && styles.checkboxSelected]}>
                {transferOptions.erc20 && <IconSymbol name="checkmark" size={16} color="#FFFFFF" />}
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.transferModalFooter}>
          <TouchableOpacity style={styles.transferCancelButton} onPress={onClose}>
            <Text style={styles.transferCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.transferConfirmButton} onPress={onConfirm}>
            <Text style={styles.transferConfirmButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
