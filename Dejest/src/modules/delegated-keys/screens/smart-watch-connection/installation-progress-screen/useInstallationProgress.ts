import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { installationState, GlobalInstallationState } from '@/services/storage/installationState';

export function useInstallationProgress() {
  const [globalState, setGlobalState] = useState<GlobalInstallationState>(installationState.getState());
  const [progressAnimation] = useState(new Animated.Value(globalState.progress ?? 0));

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
  };
}
