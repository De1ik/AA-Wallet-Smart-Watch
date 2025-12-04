import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles } from '../styles';
import { PermissionPolicyType } from '@/domain/types';

type Props = {
  keyType: PermissionPolicyType;
  isWatchConnected: boolean;
  onSelect: (type: PermissionPolicyType) => void;
};

export const KeyTypeSelector = ({ keyType, isWatchConnected, onSelect }: Props) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Key Type</Text>
    <Text style={styles.sectionSubtitle}>
      {isWatchConnected ? 'Choose the level of access for your smart watch' : 'Connect Apple Watch to configure key type'}
    </Text>

    <View style={[styles.keyTypeContainer, !isWatchConnected && styles.keyTypeContainerDisabled]}>
      <TouchableOpacity
        style={[
          styles.keyTypeOption,
          keyType === PermissionPolicyType.CALL_POLICY && styles.keyTypeOptionSelected,
          !isWatchConnected && styles.keyTypeOptionDisabled,
        ]}
        onPress={() => isWatchConnected && onSelect(PermissionPolicyType.CALL_POLICY)}
        disabled={!isWatchConnected}
      >
        <View style={styles.keyTypeHeader}>
          <IconSymbol name="lock.shield.fill" size={24} color={keyType === PermissionPolicyType.CALL_POLICY ? '#10B981' : '#A0A0A0'} />
          <Text style={[styles.keyTypeTitle, keyType === PermissionPolicyType.CALL_POLICY && styles.keyTypeTitleSelected]}>
            Restricted Access
          </Text>
        </View>
        <Text style={styles.keyTypeDescription}>Custom permissions with specific function and parameter restrictions</Text>
        <View style={[styles.recommendedBadge, keyType === PermissionPolicyType.CALL_POLICY && styles.recommendedBadgeSelected]}>
          <Text style={[styles.recommendedText, keyType === PermissionPolicyType.CALL_POLICY && styles.recommendedTextSelected]}>
            Recommended
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.keyTypeOption,
          keyType === PermissionPolicyType.SUDO && styles.keyTypeOptionSelected,
          !isWatchConnected && styles.keyTypeOptionDisabled,
        ]}
        onPress={() => isWatchConnected && onSelect(PermissionPolicyType.SUDO)}
        disabled={!isWatchConnected}
      >
        <View style={styles.keyTypeHeader}>
          <IconSymbol name="key.fill" size={24} color={keyType === PermissionPolicyType.SUDO ? '#EF4444' : '#A0A0A0'} />
          <Text style={[styles.keyTypeTitle, keyType === PermissionPolicyType.SUDO && styles.keyTypeTitleSelected]}>Sudo Access</Text>
        </View>
        <Text style={styles.keyTypeDescription}>Full access to all wallet functions</Text>
        <View style={[styles.warningBadge, keyType === PermissionPolicyType.SUDO && styles.warningBadgeSelected]}>
          <Text style={[styles.warningBadgeText, keyType === PermissionPolicyType.SUDO && styles.warningTextSelected]}>Not Recommended</Text>
        </View>
      </TouchableOpacity>
    </View>
  </View>
);
