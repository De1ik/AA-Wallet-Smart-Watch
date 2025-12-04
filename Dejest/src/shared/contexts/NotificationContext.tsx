import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';

type NotificationType = 'success' | 'error' | 'info';

interface NotificationOptions {
  title?: string;
  duration?: number;
}

interface NotificationState {
  type: NotificationType;
  message: string;
  title?: string;
  duration: number;
}

interface NotificationContextValue {
  showNotification: (type: NotificationType, message: string, options?: NotificationOptions) => void;
  showSuccess: (message: string, options?: NotificationOptions) => void;
  showError: (message: string, options?: NotificationOptions) => void;
  showInfo: (message: string, options?: NotificationOptions) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const TYPE_STYLES: Record<
  NotificationType,
  { accent: string; icon: Parameters<typeof IconSymbol>[0]['name']; background: string }
> = {
  success: { accent: '#10B981', icon: 'checkmark.circle.fill', background: '#0F1D15' },
  error: { accent: '#EF4444', icon: 'exclamationmark.triangle.fill', background: '#1F1212' },
  info: { accent: '#3B82F6', icon: 'info.circle.fill', background: '#0F172A' },
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [current, setCurrent] = useState<NotificationState | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const hideNotification = useCallback(() => {
    clearTimer();
    Animated.timing(translateY, {
      toValue: -120,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setCurrent(null));
  }, [clearTimer, translateY]);

  const animateIn = useCallback(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const showNotification = useCallback(
    (type: NotificationType, message: string, options?: NotificationOptions) => {
      clearTimer();
      const duration = options?.duration ?? 3200;
      setCurrent({ type, message, title: options?.title, duration });
      animateIn();

      timeoutRef.current = setTimeout(() => {
        hideNotification();
      }, duration);
    },
    [animateIn, clearTimer, hideNotification],
  );

  useEffect(
    () => () => {
      clearTimer();
    },
    [clearTimer],
  );

  const contextValue = useMemo(
    (): NotificationContextValue => ({
      showNotification,
      showSuccess: (message, options) => showNotification('success', message, options),
      showError: (message, options) => showNotification('error', message, options),
      showInfo: (message, options) => showNotification('info', message, options),
      hideNotification,
    }),
    [hideNotification, showNotification],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {current ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastContainer,
            { transform: [{ translateY }] },
            { backgroundColor: TYPE_STYLES[current.type].background },
          ]}
        >
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: `${TYPE_STYLES[current.type].accent}22` },
            ]}
          >
            <IconSymbol name={TYPE_STYLES[current.type].icon} size={20} color={TYPE_STYLES[current.type].accent} />
          </View>
          <View style={styles.toastContent}>
            {current.title ? (
              <Text style={[styles.toastTitle, { color: TYPE_STYLES[current.type].accent }]}>
                {current.title}
              </Text>
            ) : null}
            <Text style={styles.toastMessage}>{current.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  iconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toastMessage: {
    color: '#F9FAFB',
    fontSize: 14,
    lineHeight: 18,
  },
});
