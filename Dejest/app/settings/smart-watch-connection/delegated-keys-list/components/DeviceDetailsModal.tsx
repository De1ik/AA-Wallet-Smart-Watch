import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { styles } from '../styles';
import { DelegatedKeyData } from '@/utils/delegatedKeys';

type Props = {
  visible: boolean;
  device: DelegatedKeyData | null;
  onClose: () => void;
  onRevoke: (device: DelegatedKeyData) => void;
};

export const DeviceDetailsModal = ({ visible, device, onClose, onRevoke }: Props) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Device Details</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <IconSymbol name="xmark" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {device && (
          <View style={styles.modalContent}>
            <View style={styles.deviceInfoHeader}>
              <IconSymbol name="applewatch" size={32} color="#8B5CF6" />
              <Text style={styles.modalDeviceName}>{device.deviceName}</Text>
            </View>

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Key Type:</Text>
                <View
                  style={[
                    styles.keyTypeBadge,
                    device.keyType === 'sudo' ? styles.sudoBadge : styles.restrictedBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.keyTypeText,
                      device.keyType === 'sudo' ? styles.sudoText : styles.restrictedText,
                    ]}
                  >
                    {device.keyType === 'sudo' ? 'Sudo Access' : 'Restricted Access'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created:</Text>
                <Text style={styles.detailValue}>{new Date(device.createdAt).toLocaleDateString()}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Permission ID:</Text>
                <Text style={styles.detailValueFull}>{device.permissionId}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Public Address:</Text>
                <Text style={styles.detailValueFull}>{device.publicAddress}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>vId:</Text>
                <Text style={styles.detailValueFull}>{device.vId}</Text>
              </View>

              {device.whitelistAddresses && device.whitelistAddresses.length > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Whitelist Addresses:</Text>
                  <View style={styles.addressList}>
                    {device.whitelistAddresses.map((address, index) => (
                      <Text key={index} style={styles.detailValueFull}>
                        {address}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {device.tokenLimits && device.tokenLimits.length > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Token Limits:</Text>
                  <View style={styles.tokenLimitsList}>
                    {device.tokenLimits.map((limit, index) => (
                      <View key={index} style={styles.tokenLimitItem}>
                        <Text style={styles.detailValueFull}>
                          {limit.tokenSymbol}: {limit.maxAmountPerTx} per tx, {limit.maxAmountPerDay} per day
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.revokeFromDetailsButton}
                onPress={() => onRevoke(device)}
              >
                <IconSymbol name="trash" size={16} color="#FFFFFF" />
                <Text style={styles.revokeFromDetailsButtonText}>Revoke Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  </Modal>
);
