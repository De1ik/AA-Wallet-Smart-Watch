import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { DelegatedKeyData } from '@/modules/delegated-keys/services/delegatedKeys';
import { GlobalInstallationState } from '@/services/storage/installationState';
import { styles } from '../styles';
import { PermissionPolicyType } from '@/domain/types';

type Props = {
  ongoingInstallation: DelegatedKeyData;
  globalInstallationState: GlobalInstallationState;
  onViewInstallation: (device: DelegatedKeyData) => void;
};

export const OngoingInstallationCard = ({
  ongoingInstallation,
  globalInstallationState,
  onViewInstallation,
}: Props) => (
  <View style={styles.ongoingInstallationCard}>
    <View style={styles.ongoingHeader}>
      <IconSymbol name="applewatch" size={24} color="#8B5CF6" />
      <Text style={styles.ongoingTitle}>
        {globalInstallationState.status?.step === 'completed' ? 'Installation Complete' : 'Installing...'}
      </Text>
      <View style={styles.ongoingBadge}>
        <Text style={styles.ongoingBadgeText}>
          {globalInstallationState.status?.step === 'completed' ? 'COMPLETED' : 'IN PROGRESS'}
        </Text>
      </View>
    </View>

    <View style={styles.ongoingDetails}>
      <Text style={styles.ongoingDeviceName}>{ongoingInstallation.deviceName}</Text>
      <Text style={styles.ongoingKeyType}>
        {ongoingInstallation.keyType === PermissionPolicyType.SUDO ? 'Sudo Access' : 'Restricted Access'}
      </Text>

      {ongoingInstallation.installationProgress ? (
        <View style={styles.ongoingProgress}>
          <View style={styles.ongoingProgressBar}>
            <View style={[styles.ongoingProgressFill, { width: `${globalInstallationState.progress}%` }]} />
          </View>
          <Text style={styles.ongoingProgressText}>{globalInstallationState.currentStep}</Text>
        </View>
      ) : (
        <View style={styles.ongoingProgress}>
          <View style={styles.ongoingProgressBar}>
            <View style={[styles.ongoingProgressFill, { width: '100%' }]} />
          </View>
          <Text style={styles.ongoingProgressText}>Installation Complete</Text>
        </View>
      )}
    </View>

    <TouchableOpacity style={styles.viewInstallationButton} onPress={() => onViewInstallation(ongoingInstallation)}>
      <IconSymbol name="arrow.right" size={16} color="#8B5CF6" />
      <Text style={styles.viewInstallationText}>View Progress</Text>
    </TouchableOpacity>
  </View>
);
