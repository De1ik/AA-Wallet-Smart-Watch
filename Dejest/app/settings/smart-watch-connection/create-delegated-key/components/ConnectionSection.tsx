import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
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
}: Props) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Smart Watch Connection</Text>
    <View
      style={[
        styles.connectionStatus,
        isWatchConnected ? styles.connectionStatusConnected : styles.connectionStatusDisconnected,
      ]}
    >
      <IconSymbol
        name={isWatchConnected ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
        size={20}
        color={isWatchConnected ? '#10B981' : '#EF4444'}
      />
      <View style={styles.connectionInfo}>
        <Text
          style={[
            styles.connectionStatusText,
            isWatchConnected ? styles.connectionStatusTextConnected : styles.connectionStatusTextDisconnected,
          ]}
        >
          {isWatchConnected ? 'Connected to Apple Watch' : 'Apple Watch Not Connected'}
        </Text>
        {isWatchLoading && <Text style={styles.connectionSubtext}>Checking connection...</Text>}
        {!isWatchConnected && !isWatchLoading && (
          <Text style={styles.connectionSubtext}>
            Ensure your Apple Watch is paired and the Dejest app is installed
          </Text>
        )}
      </View>
      <TouchableOpacity style={styles.refreshButton} onPress={checkConnection} disabled={isWatchLoading}>
        <IconSymbol name="arrow.clockwise" size={16} color="#8B5CF6" />
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
