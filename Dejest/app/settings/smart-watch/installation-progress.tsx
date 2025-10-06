import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { wsClient } from '@/utils/websocketClient';
import { InstallationStatus } from '@/utils/apiClient';
import { installationState, GlobalInstallationState } from '@/utils/installationState';

const { width } = Dimensions.get('window');

export default function InstallationProgressScreen() {
  const { deviceId, deviceName, keyType } = useLocalSearchParams();
  const [globalState, setGlobalState] = useState<GlobalInstallationState>(installationState.getState());
  const [progressAnimation] = useState(new Animated.Value(globalState.progress));

  const steps = [
    'Generating key pair',
    'Installing permission',
    'Enabling selector',
    'Granting access'
  ];

  useEffect(() => {
    // Subscribe to global installation state changes
    const unsubscribe = installationState.subscribe((state) => {
      console.log('[InstallationProgress] Global state update:', state);
      setGlobalState(state);
      
      // Animate progress bar
      Animated.timing(progressAnimation, {
        toValue: state.progress,
        duration: 500,
        useNativeDriver: false,
      }).start();
      
      // Handle completion
      if (state.status?.step === 'completed') {
        setTimeout(() => {
          router.back();
        }, 2000);
      } else if (state.status?.step === 'failed') {
        setTimeout(() => {
          router.back();
        }, 3000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleBack = () => {
    router.back();
  };

  const progressBarWidth = progressAnimation.interpolate({
    inputRange: [0, 100],
    outputRange: [0, width - 80],
    extrapolate: 'clamp',
  });

  // Calculate completed steps based on global state
  const getCompletedSteps = () => {
    if (!globalState.status) return 0;
    
    switch (globalState.status.step) {
      case 'installing':
        return globalState.progress < 50 ? 0 : 1;
      case 'granting':
        return globalState.progress < 80 ? 1 : 2;
      case 'completed':
        return 3;
      default:
        return 0;
    }
  };

  const completedSteps = getCompletedSteps();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
          >
            <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Installing Delegated Key</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          {/* Device Info */}
          <View style={styles.deviceInfo}>
            <IconSymbol name="applewatch" size={64} color="#8B5CF6" />
            <Text style={styles.deviceName}>{globalState.deviceName || deviceName as string}</Text>
            <Text style={styles.keyType}>
              {globalState.keyType === 'sudo' ? 'Sudo Access' : 'Restricted Access'}
            </Text>
          </View>

          {/* Simplified Progress Animation */}
          <View style={styles.progressContainer}>
            {/* Progress Steps */}
            <View style={styles.progressSteps}>
              <View style={styles.progressStep}>
                <View style={[
                  styles.progressStepIcon,
                  completedSteps >= 1 ? styles.progressStepCompleted : styles.progressStepPending
                ]}>
                  {completedSteps >= 1 ? (
                    <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.progressStepNumber}>1</Text>
                  )}
                </View>
                <Text style={[
                  styles.progressStepText,
                  completedSteps >= 1 ? styles.progressStepTextCompleted : styles.progressStepTextPending
                ]}>
                  Install
                </Text>
              </View>

              <View style={styles.progressStep}>
                <View style={[
                  styles.progressStepIcon,
                  completedSteps >= 2 ? styles.progressStepCompleted : styles.progressStepPending
                ]}>
                  {completedSteps >= 2 ? (
                    <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.progressStepNumber}>2</Text>
                  )}
                </View>
                <Text style={[
                  styles.progressStepText,
                  completedSteps >= 2 ? styles.progressStepTextCompleted : styles.progressStepTextPending
                ]}>
                  Grant Access
                </Text>
              </View>

              <View style={styles.progressStep}>
                <View style={[
                  styles.progressStepIcon,
                  completedSteps >= 3 ? styles.progressStepCompleted : styles.progressStepPending
                ]}>
                  {completedSteps >= 3 ? (
                    <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.progressStepNumber}>3</Text>
                  )}
                </View>
                <Text style={[
                  styles.progressStepText,
                  completedSteps >= 3 ? styles.progressStepTextCompleted : styles.progressStepTextPending
                ]}>
                  Complete
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    { width: progressBarWidth }
                  ]}
                />
              </View>
            </View>

            {/* Current Step Message */}
            <View style={styles.currentStepContainer}>
              <Text style={styles.currentStepText}>{globalState.currentStep}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
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
  content: {
    flex: 1,
    padding: 20,
  },
  deviceInfo: {
    alignItems: 'center',
    marginBottom: 60,
  },
  deviceName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 8,
  },
  keyType: {
    fontSize: 18,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  progressContainer: {
    alignItems: 'center',
    gap: 40,
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 300,
    gap: 20,
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
    maxWidth: 300,
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
  currentStepContainer: {
    alignItems: 'center',
  },
  currentStepText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
  },
});
