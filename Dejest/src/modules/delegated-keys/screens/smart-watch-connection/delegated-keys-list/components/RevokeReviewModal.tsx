import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { DelegatedKeyData } from '@/modules/delegated-keys/services/delegatedKeys';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles } from '../styles';

type Props = {
  visible: boolean;
  device?: DelegatedKeyData | null;
  delegatedAddress: string;
  kernelAddress: string;
  revocationId: string;
  userOpHash: string;
  gasEstimateEth?: string;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
};

export const RevokeReviewModal = ({
  visible,
  device,
  delegatedAddress,
  kernelAddress,
  revocationId,
  userOpHash,
  gasEstimateEth,
  onClose,
  onConfirm,
  isSubmitting,
}: Props) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlayCenter}>
      <View style={styles.reviewModal}>
        <View style={styles.reviewHeader}>
          <IconSymbol name="shield.slash" size={20} color="#F87171" />
          <Text style={styles.reviewTitle}>Review Revocation</Text>
        </View>
        <Text style={styles.reviewSubtitle}>
          Remove delegated access for {device?.deviceName || 'this device'}. This action cannot be undone.
        </Text>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Device</Text>
          <Text style={styles.reviewValue}>{device?.deviceName || 'Unknown device'}</Text>
        </View>
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Delegated Address</Text>
          <Text style={styles.reviewValueMonospace}>{delegatedAddress}</Text>
        </View>
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Kernel</Text>
          <Text style={styles.reviewValueMonospace}>{kernelAddress}</Text>
        </View>
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Revocation ID</Text>
          <Text style={styles.reviewValueMonospace}>{revocationId}</Text>
        </View>
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>UserOp Hash</Text>
          <Text style={styles.reviewValueMonospace}>{userOpHash}</Text>
        </View>
        {gasEstimateEth ? (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Estimated Gas</Text>
            <Text style={styles.reviewValue}>{gasEstimateEth} ETH</Text>
          </View>
        ) : null}

        <View style={styles.reviewWarning}>
          <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#F59E0B" />
          <Text style={styles.reviewWarningText}>
            You will sign and broadcast this transaction. Make sure the details are correct before continuing.
          </Text>
        </View>

        <View style={styles.reviewActions}>
          <TouchableOpacity style={styles.reviewCancelButton} onPress={onClose} disabled={isSubmitting}>
            <Text style={styles.reviewCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reviewConfirmButton, isSubmitting && styles.reviewConfirmButtonDisabled]}
            onPress={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#111111" />
            ) : (
              <Text style={styles.reviewConfirmText}>Sign & Broadcast</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
