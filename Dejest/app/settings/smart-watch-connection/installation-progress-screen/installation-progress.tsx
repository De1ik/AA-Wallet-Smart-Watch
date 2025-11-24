import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useInstallationProgress } from './useInstallationProgress';
import { useEffect } from 'react';

const { width } = Dimensions.get('window');

export default function InstallationProgressScreen() {
  const { deviceId, deviceName, keyType } = useLocalSearchParams();
  const { globalState, progressAnimation, completedSteps } = useInstallationProgress();

  useEffect(() => {
    if (globalState.status?.step === 'completed') {
      const timeout = setTimeout(() => {
        router.replace('/settings/smart-watch-connection/delegated-keys-list/smart-watch');
      }, 1200);
      return () => clearTimeout(timeout);
    }
    if (globalState.status?.step === 'failed') {
      const timeout = setTimeout(() => router.back(), 3000);
      return () => clearTimeout(timeout);
    }
  }, [globalState.status]);

  const handleBack = () => {
    router.replace('/settings/smart-watch-connection/delegated-keys-list/smart-watch');
  };

  const progressBarWidth = progressAnimation.interpolate({
    inputRange: [0, 100],
    outputRange: [0, width - 80],
    extrapolate: 'clamp',
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <IconSymbol name="chevron.left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Installing Delegated Key</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <IconSymbol name="applewatch" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroLabel}>Device</Text>
            <Text style={styles.heroTitle}>{(globalState.deviceName || deviceName) as string}</Text>
            <Text style={styles.heroSubtitle}>
              {globalState.keyType === 'sudo' ? 'Sudo Access' : 'Restricted Access'}
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              globalState.status?.step === 'completed' && styles.statusSuccess,
              globalState.status?.step === 'failed' && styles.statusError,
            ]}
          >
            <Text style={styles.statusPillText}>
              {globalState.status?.step === 'completed'
                ? 'Completed'
                : globalState.status?.step === 'failed'
                ? 'Failed'
                : 'In Progress'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.progressSteps}>
            {['Install', 'Grant Access', 'Complete'].map((label, idx) => {
              const step = idx + 1;
              const done = completedSteps >= step;
              return (
                <View key={label} style={styles.progressStep}>
                  <View
                    style={[
                      styles.progressStepIcon,
                      done ? styles.progressStepCompleted : styles.progressStepPending,
                    ]}
                  >
                    {done ? (
                      <IconSymbol name="checkmark" size={18} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.progressStepNumber}>{step}</Text>
                    )}
                  </View>
                  <Text style={[styles.progressStepText, done ? styles.progressStepTextCompleted : styles.progressStepTextPending]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View style={[styles.progressBarFill, { width: progressBarWidth }]} />
            </View>
            <Text style={styles.progressPercent}>{Math.round(globalState.status?.progress ?? 0)}%</Text>
          </View>

          <View style={styles.currentStepContainer}>
            <Text style={styles.currentStepLabel}>Current step</Text>
            <Text style={styles.currentStepText}>{globalState.currentStep}</Text>
          </View>
        </View>

        {globalState.status?.step === 'failed' && (
          <View style={[styles.card, styles.errorCard]}>
            <View style={styles.errorRow}>
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#F97316" />
              <Text style={styles.errorTitle}>Installation failed</Text>
            </View>
            <Text style={styles.errorText}>
              {globalState.status?.message || 'Something went wrong during installation.'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleBack}>
              <Text style={styles.retryText}>Back to devices</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#0F0F14',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  hero: {
    margin: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#13131A',
    borderWidth: 1,
    borderColor: '#262636',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroLabel: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: '#8B5CF6',
    fontSize: 13,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1F2937',
  },
  statusSuccess: {
    backgroundColor: '#0B7A47',
  },
  statusError: {
    backgroundColor: '#7A0B1A',
  },
  statusPillText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  card: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#111118',
    borderWidth: 1,
    borderColor: '#242433',
    gap: 20,
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  progressStep: {
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  progressStepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepCompleted: {
    backgroundColor: '#10B981',
  },
  progressStepPending: {
    backgroundColor: '#333333',
    borderWidth: 2,
    borderColor: '#666666',
  },
  progressStepNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  progressStepText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  progressStepTextCompleted: {
    color: '#10B981',
  },
  progressStepTextPending: {
    color: '#666666',
  },
  progressBarContainer: {
    width: '100%',
    gap: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  progressPercent: {
    alignSelf: 'flex-end',
    color: '#A0A0A0',
    fontSize: 12,
    fontWeight: '600',
  },
  currentStepContainer: {
    alignItems: 'center',
    gap: 6,
  },
  currentStepLabel: {
    color: '#A0A0A0',
    fontSize: 12,
    fontWeight: '600',
  },
  currentStepText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorCard: {
    marginTop: 16,
    gap: 12,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    color: '#F97316',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  retryText: {
    color: '#8B5CF6',
    fontWeight: '700',
  },
});
