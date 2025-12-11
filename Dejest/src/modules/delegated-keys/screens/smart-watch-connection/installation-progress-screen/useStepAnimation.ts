import { useEffect, useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import { PermissionPolicyType } from '@/domain/types';
import { useInstallationProgress } from './useInstallationProgress';

export const USE_STEP_ANIMATION_DEFAULTS = {
  installThreshold: 25,
  grantThreshold: 50,
  recipientThreshold: 75,
  tokenThreshold: 85,
};

export const useStepAnimation = (keyType: PermissionPolicyType | undefined) => {
  const { globalState, progressAnimation } = useInstallationProgress();
  const derivedKeyType = globalState.keyType ?? keyType ?? PermissionPolicyType.CALL_POLICY;

  const steps = useMemo(() => {
    const base = [
      { label: 'Install permission validation', threshold: USE_STEP_ANIMATION_DEFAULTS.installThreshold },
      { label: 'Grant delegated execution', threshold: USE_STEP_ANIMATION_DEFAULTS.grantThreshold },
    ];

    if (derivedKeyType === PermissionPolicyType.CALL_POLICY) {
      base.push(
        { label: 'Apply recipient restrictions', threshold: USE_STEP_ANIMATION_DEFAULTS.recipientThreshold },
        { label: 'Configure token allowances', threshold: USE_STEP_ANIMATION_DEFAULTS.tokenThreshold }
      );
    }

    return base;
  }, [derivedKeyType]);

  const progressValue = globalState.progress ?? 0;
  const completedSteps = steps.filter((step) => progressValue >= step.threshold).length;
  const firstIncompleteIndex = steps.findIndex((step) => progressValue < step.threshold);
  const activeStepIndex = firstIncompleteIndex === -1 ? steps.length - 1 : firstIncompleteIndex;
  const trackerOpacity = useRef(new Animated.Value(progressValue >= 100 ? 0 : 1)).current;
  const completeOpacity = useRef(new Animated.Value(progressValue >= 100 ? 1 : 0)).current;

  useEffect(() => {
    const isComplete = progressValue >= 100;
    Animated.timing(trackerOpacity, {
      toValue: isComplete ? 0 : 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    Animated.timing(completeOpacity, {
      toValue: isComplete ? 1 : 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [progressValue, trackerOpacity, completeOpacity]);

  return {
    globalState,
    progressAnimation,
    steps,
    progressValue,
    completedSteps,
    activeStepIndex,
    trackerOpacity,
    completeOpacity,
  };
};
