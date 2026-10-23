import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { SOS_HOLD_DURATION_MS } from '../constants/timing';

interface SosButtonProps {
  onTrigger: () => void;
  disabled?: boolean;
}

export const SosButton: React.FC<SosButtonProps> = ({ onTrigger, disabled = false }) => {
  const [isPressing, setIsPressing] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredRef = useRef<boolean>(false);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      cleanTimers();
    };
  }, []);

  const cleanTimers = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    setIsPressing(false);
  };

  const resetAnimation = () => {
    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startHolding = () => {
    if (disabled || hasTriggeredRef.current) return;
    setIsPressing(true);
    hasTriggeredRef.current = false;

    // Initial impact haptic
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    // Repeat light haptic pulse while holding
    hapticIntervalRef.current = setInterval(() => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }, 200);

    // Animate progress and scale for SOS_HOLD_DURATION_MS (500ms)
    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: SOS_HOLD_DURATION_MS,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: SOS_HOLD_DURATION_MS - 50,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Trigger after hold duration
    holdTimerRef.current = setTimeout(() => {
      cleanTimers();
      hasTriggeredRef.current = true;
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      resetAnimation();
      onTrigger();

      // Reset trigger lock after short cooldown to prevent double taps
      setTimeout(() => {
        hasTriggeredRef.current = false;
      }, 1000);
    }, SOS_HOLD_DURATION_MS);
  };

  const cancelHolding = () => {
    // If released before 500ms, cancel
    if (!hasTriggeredRef.current) {
      cleanTimers();
      resetAnimation();
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.outerContainer}>
      {/* Outer Pulse Glow Ring */}
      <View style={[styles.glowRing, isPressing && styles.glowRingActive]} />

      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            disabled && styles.buttonDisabled,
          ]}
          onPressIn={startHolding}
          onPressOut={cancelHolding}
          accessibilityRole="button"
          accessibilityLabel="Emergency SOS button. Press and hold for 0.5 seconds to trigger emergency assistance."
          accessibilityHint="Activates 3-second countdown and dispatches emergency alert to contacts"
          disabled={disabled}
        >
          {/* Progress fill overlay */}
          <Animated.View
            style={[
              styles.progressOverlay,
              {
                height: progressWidth,
              },
            ]}
          />

          <View style={styles.content}>
            <Ionicons name="warning" size={44} color="#FFFFFF" />
            <Text style={styles.titleText}>SOS</Text>
            <Text style={styles.subText}>
              {isPressing ? 'KEEP HOLDING...' : 'HOLD 0.5s'}
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      <Text style={styles.safetyNotice}>
        0.5-second deliberate hold activates 3s cancelable countdown
      </Text>
    </View>
  );
};

const BUTTON_SIZE = 170;

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
  },
  glowRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 36,
    height: BUTTON_SIZE + 36,
    borderRadius: (BUTTON_SIZE + 36) / 2,
    backgroundColor: colors.emergencyMuted,
    opacity: 0.6,
  },
  glowRingActive: {
    backgroundColor: '#FCA5A5',
    opacity: 0.9,
    transform: [{ scale: 1.15 }],
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: colors.emergency,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.emergencyDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  buttonDisabled: {
    backgroundColor: colors.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  progressOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.emergencyDark,
    opacity: 0.95,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 2,
  },
  subText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
    opacity: 0.95,
  },
  safetyNotice: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
