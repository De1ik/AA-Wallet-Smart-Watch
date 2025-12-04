import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { COLORS } from '@/shared/constants/colors';
import { styles } from '../styles';

type Props = {
  isWatchConnected: boolean;
  isWatchLoading: boolean;
  watchError?: string | null;
  checkConnection: () => void;
};

export const ConnectionSection = ({
  isWatchConnected,
  isWatchLoading,
  watchError,
  checkConnection,
}: Props) => {
  const primaryText = isWatchConnected ? 'Connected to Apple Watch' : 'Apple Watch Not Connected';
  const subtitle = isWatchLoading
    ? 'Checking connection...'
    : isWatchConnected
    ? 'Your watch is ready to sign delegated keys.'
    : 'Pair the watch, open Dejest on the watch, then refresh.';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Smart Watch Connection</Text>
      <View
        style={[
          styles.connectionStatus,
          isWatchConnected ? styles.connectionStatusConnected : styles.connectionStatusDisconnected,
        ]}
      >
        <View
          style={[
            styles.connectionIconWrapper,
            isWatchConnected ? styles.connectionIconConnected : styles.connectionIconDisconnected,
          ]}
        >
          <IconSymbol
            name={isWatchConnected ? 'checkmark' : 'xmark'}
            size={16}
            color={isWatchConnected ? '#0F1A0F' : COLORS.red}
          />
        </View>
        <View style={styles.connectionInfo}>
          <Text
            style={[
              styles.connectionStatusText,
              isWatchConnected ? styles.connectionStatusTextConnected : styles.connectionStatusTextDisconnected,
            ]}
          >
            {primaryText}
          </Text>
          <Text style={styles.connectionSubtext}>{subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={checkConnection} disabled={isWatchLoading}>
          <IconSymbol name="arrow.clockwise" size={16} color="#C4B5FD" />
        </TouchableOpacity>
      </View>

      {watchError && (
        <View style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{watchError}</Text>
        </View>
      )}

      {!isWatchConnected && !isWatchLoading && (
        <View style={styles.warningContainer}>
          <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#F59E0B" />
          <View style={styles.warningContent}>
            <Text style={styles.warningSectionTitle}>Smart Watch Required</Text>
            <Text style={styles.warningText}>
              You need a connected Apple Watch to create delegated keys. The watch will generate and securely store the
              private keys.
            </Text>
            <Text style={styles.warningSteps}>Steps to connect:</Text>
            <Text style={styles.warningStep}>1. Ensure your Apple Watch is paired with this iPhone</Text>
            <Text style={styles.warningStep}>2. Install the Dejest app on your Apple Watch</Text>
            <Text style={styles.warningStep}>3. Open the Dejest app on your watch</Text>
            <Text style={styles.warningStep}>4. Tap "Refresh" above to check connection</Text>
          </View>
        </View>
      )}
    </View>
  );
};
