import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { styles } from '../styles';
import { DelegatedKeyData } from '@/utils/delegatedKeys';

type Props = {
  visible: boolean;
  device: DelegatedKeyData | null;
  onClose: () => void;
};

export const InstallationDetailsModal = ({ visible, device, onClose }: Props) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Installation Progress</Text>
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

            {device.installationProgress && (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressTitle}>Installation Status</Text>
                  <Text style={styles.progressStep}>
                    Step {device.installationProgress.completedSteps} of {device.installationProgress.totalSteps}
                  </Text>
                </View>

                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${(device.installationProgress.completedSteps / device.installationProgress.totalSteps) * 100}%`,
                      },
                    ]}
                  />
                </View>

                <View style={styles.currentStepContainer}>
                  <Text style={styles.currentStepLabel}>Current Step:</Text>
                  <Text style={styles.currentStepText}>{device.installationProgress.currentStep}</Text>
                </View>

                {device.installationProgress.transactionStatus && (
                  <View style={styles.transactionStatusContainer}>
                    <Text style={styles.transactionStatusLabel}>Transaction Status:</Text>
                    <Text style={styles.transactionStatusText}>{device.installationProgress.transactionStatus}</Text>
                  </View>
                )}

                {device.installationProgress.currentNonce && (
                  <View style={styles.nonceContainer}>
                    <Text style={styles.nonceLabel}>Current Nonce:</Text>
                    <Text style={styles.nonceText}>{device.installationProgress.currentNonce}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalNote}>
              <IconSymbol name="info.circle" size={16} color="#8B5CF6" />
              <Text style={styles.modalNoteText}>
                This device is being set up on the blockchain. The process may take a few minutes.
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  </Modal>
);
