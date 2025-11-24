import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { styles } from '../styles';
import { KeyType } from '@/utils/delegatedKeys';

type Props = {
  keyType: KeyType;
  isWatchConnected: boolean;
  onSelect: (type: KeyType) => void;
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
          keyType === 'restricted' && styles.keyTypeOptionSelected,
          !isWatchConnected && styles.keyTypeOptionDisabled,
        ]}
        onPress={() => isWatchConnected && onSelect('restricted')}
        disabled={!isWatchConnected}
      >
        <View style={styles.keyTypeHeader}>
          <IconSymbol name="lock.shield.fill" size={24} color={keyType === 'restricted' ? '#10B981' : '#A0A0A0'} />
          <Text style={[styles.keyTypeTitle, keyType === 'restricted' && styles.keyTypeTitleSelected]}>
            Restricted Access
          </Text>
        </View>
        <Text style={styles.keyTypeDescription}>Custom permissions with specific function and parameter restrictions</Text>
        <View style={[styles.recommendedBadge, keyType === 'restricted' && styles.recommendedBadgeSelected]}>
          <Text style={[styles.recommendedText, keyType === 'restricted' && styles.recommendedTextSelected]}>
            Recommended
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.keyTypeOption,
          keyType === 'sudo' && styles.keyTypeOptionSelected,
          !isWatchConnected && styles.keyTypeOptionDisabled,
        ]}
        onPress={() => isWatchConnected && onSelect('sudo')}
        disabled={!isWatchConnected}
      >
        <View style={styles.keyTypeHeader}>
          <IconSymbol name="key.fill" size={24} color={keyType === 'sudo' ? '#EF4444' : '#A0A0A0'} />
          <Text style={[styles.keyTypeTitle, keyType === 'sudo' && styles.keyTypeTitleSelected]}>Sudo Access</Text>
        </View>
        <Text style={styles.keyTypeDescription}>Full access to all wallet functions</Text>
        <View style={[styles.warningBadge, keyType === 'sudo' && styles.warningBadgeSelected]}>
          <Text style={[styles.warningBadgeText, keyType === 'sudo' && styles.warningTextSelected]}>Not Recommended</Text>
        </View>
      </TouchableOpacity>
    </View>
  </View>
);
