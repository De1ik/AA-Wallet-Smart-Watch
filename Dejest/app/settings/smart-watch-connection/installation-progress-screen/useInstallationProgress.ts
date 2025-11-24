import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { installationState, GlobalInstallationState } from '@/utils/installationState';

const DEFAULT_PROGRESS = 0;

const computeCompletedSteps = (state: GlobalInstallationState) => {
  if (!state.status) return 0;
  switch (state.status.step) {
    case 'installing':
      return state.progress < 50 ? 0 : 1;
    case 'granting':
      return state.progress < 80 ? 1 : 2;
    case 'completed':
      return 3;
    default:
      return 0;
  }
};

export function useInstallationProgress() {
  const [globalState, setGlobalState] = useState<GlobalInstallationState>(installationState.getState());
  const [progressAnimation] = useState(new Animated.Value(globalState.progress ?? DEFAULT_PROGRESS));

  useEffect(() => {
    const unsubscribe = installationState.subscribe((state) => {
      setGlobalState(state);
      Animated.timing(progressAnimation, {
        toValue: state.progress,
        duration: 500,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    globalState,
    progressAnimation,
    completedSteps: computeCompletedSteps(globalState),
  };
}
