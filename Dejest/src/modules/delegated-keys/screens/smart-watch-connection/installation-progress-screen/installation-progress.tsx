import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { PermissionPolicyType } from '@/domain/types';
import { useStepAnimation } from './useStepAnimation';

const progressWidth = Dimensions.get('window').width - 80;

type InstallationProgressParams = {
  deviceId?: string;
  deviceName?: string;
  keyType?: string;
  origin?: string;
};

export default function InstallationProgressScreen() {
  const params = useLocalSearchParams<InstallationProgressParams>();
  const deviceId = Array.isArray(params.deviceId) ? params.deviceId[0] : params.deviceId;
  const deviceName = Array.isArray(params.deviceName) ? params.deviceName[0] : params.deviceName;
  const keyType = Array.isArray(params.keyType) ? params.keyType[0] : params.keyType;
  const originParam = Array.isArray(params.origin) ? params.origin[0] : params.origin;
  const cameFromList = originParam === 'list';
  const parsedKeyType = typeof keyType === 'string' ? Number(keyType) : undefined;
  const fallbackKeyType = Number.isFinite(parsedKeyType)
    ? (parsedKeyType as PermissionPolicyType)
    : PermissionPolicyType.CALL_POLICY;

  const {
    globalState,
    progressAnimation,
    steps,
    progressValue,
    completedSteps,
    activeStepIndex,
    trackerOpacity,
    completeOpacity,
  } = useStepAnimation(fallbackKeyType);

  useEffect(() => {
    if (globalState.status?.step === 'completed') {
      const timeout = setTimeout(() => {
        router.back();
      }, 1200);
      return () => clearTimeout(timeout);
    }
    if (globalState.status?.step === 'failed') {
      const timeout = setTimeout(
        // () => router.replace('/settings/smart-watch-connection/delegated-keys-list/smart-watch'),
        () => router.back(),
        3000
      );
      return () => clearTimeout(timeout);
    }
  }, [globalState.status]);

  const handleBack = () => {
    router.back();
  };

  const progressBarWidth = progressAnimation.interpolate({
    inputRange: [0, 100],
    outputRange: [0, progressWidth],
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
              {globalState.keyType === PermissionPolicyType.SUDO ? 'Sudo Access' : 'Restricted Access'}
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

        <View style={[styles.card, progressValue >= 100 && styles.cardComplete]}>
          <Animated.View style={[styles.stepTracker, { opacity: trackerOpacity, transform: [{ scale: trackerOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
            {steps.map((stepItem, idx) => {
              const stepNumber = idx + 1;
              const done = completedSteps >= stepNumber;
              const active = idx === activeStepIndex;
              return (
                <View key={stepItem.label} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      done && styles.stepCircleDone,
                      active && !done && styles.stepCircleActive,
                    ]}
                  >
                    {done ? (
                      <IconSymbol name="checkmark" size={16} color="#0D1117" />
                    ) : (
                      <Text style={[styles.stepIndex, active && styles.stepIndexActive]}>{stepNumber}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      done && styles.stepLabelDone,
                      active && !done && styles.stepLabelActive,
                    ]}
                  >
                    {stepItem.label}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
          <Animated.View style={[styles.completeWrapper, { opacity: completeOpacity, transform: [{ scale: completeOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
            <View style={styles.completeCircle}>
              <Text style={styles.completeText}>Complete</Text>
            </View>
          </Animated.View>

          {progressValue < 100 && (
            <>
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
            </>
          )}
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
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#111118',
    borderWidth: 0,
    gap: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  cardComplete: {
    paddingVertical: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 0,
  },
  stepTracker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  stepCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#2F3242',
    backgroundColor: '#141723',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    backgroundColor: '#39B981',
    borderColor: '#39B981',
  },
  stepCircleActive: {
    borderColor: '#8B5CF6',
  },
  stepIndex: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '700',
  },
  stepIndexActive: {
    color: '#8B5CF6',
  },
  stepLabel: {
    fontSize: 9,
    textAlign: 'center',
    color: '#6B7280',
  },
  stepLabelDone: {
    color: '#39B981',
    fontWeight: '600',
  },
  stepLabelActive: {
    color: '#E5E7EB',
    fontWeight: '500',
  },
  completeWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  completeCircle: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#39B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#39B981',
    shadowOpacity: 0.4,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  completeText: {
    color: '#0D1117',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.3,
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
