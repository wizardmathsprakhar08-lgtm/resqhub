import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { Button } from './Button';
import { SOS_COUNTDOWN_SECONDS } from '../constants/timing';

interface CountdownModalProps {
  visible: boolean;
  onCancel: () => void;
  onComplete: () => void;
  durationSeconds?: number;
}

export const CountdownModal: React.FC<CountdownModalProps> = ({
  visible,
  onCancel,
  onComplete,
  durationSeconds = SOS_COUNTDOWN_SECONDS,
}) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Stable refs for callbacks
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Idempotency guard: ensures onComplete is called at most once per countdown session
  const hasTriggeredRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // If modal is closed, cancel any active timer and reset state
    if (!visible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setTimeLeft(durationSeconds);
      hasTriggeredRef.current = false;
      return;
    }

    // Modal became visible: reset countdown tracking
    setTimeLeft(durationSeconds);
    hasTriggeredRef.current = false;

    // Pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Track remaining seconds outside render in timer closure
    let remaining = durationSeconds;

    const interval = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        // Clear timer interval immediately
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // PURE state update: sets timeLeft to 0 with zero side-effects
        setTimeLeft(0);

        // Execute completion side-effect safely in the timer callback (macrotask),
        // completely outside of React render phase and state updater execution!
        if (!hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          onCompleteRef.current();
        }
      } else {
        // PURE state update: update remaining seconds
        setTimeLeft(remaining);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch {}
      }
    }, 1000);

    intervalRef.current = interval;

    // Cleanup: clear timer and stop animation on unmount, close, or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      pulseLoop.stop();
    };
  }, [visible, durationSeconds, pulseAnim]);

  // Cancel handler: clears timer and invokes cancel callback
  const handleCancel = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Set guard to true so pending ticks cannot invoke onComplete
    hasTriggeredRef.current = true;
    onCancelRef.current();
  };

  // Immediate send shortcut: immediately stops timer and dispatches SOS
  const handleImmediateSend = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      setTimeLeft(0);
      onCompleteRef.current();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.header}>EMERGENCY SOS ACTIVATED</Text>
          <Text style={styles.subHeader}>
            Alert will be dispatched to your emergency contacts in:
          </Text>

          <Animated.View style={[styles.circle, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.countdownNumber}>{timeLeft}</Text>
            <Text style={styles.secondsLabel}>SECONDS</Text>
          </Animated.View>

          <Text style={styles.infoText}>
            Current GPS coordinates and emergency message will be sent.
          </Text>

          {/* Large Cancel Button */}
          <Button
            title="CANCEL SOS"
            variant="ghost"
            size="large"
            onPress={handleCancel}
            style={styles.cancelBtn}
            textStyle={styles.cancelBtnText}
            accessibilityLabel="Cancel emergency SOS"
          />

          {/* Send Immediately Shortcut */}
          <TouchableOpacity
            style={styles.immediateBtn}
            onPress={handleImmediateSend}
            accessibilityRole="button"
            accessibilityLabel="Send SOS immediately without waiting"
          >
            <Text style={styles.immediateBtnText}>Send Immediately</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 47, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.gutter,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    ...typography.h2,
    color: colors.emergency,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subHeader: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  circle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.emergencyMuted,
    borderWidth: 4,
    borderColor: colors.emergency,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  countdownNumber: {
    fontSize: 54,
    fontWeight: '900',
    color: colors.emergencyDark,
    lineHeight: 60,
  },
  secondsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.emergencyDark,
    letterSpacing: 1.5,
  },
  infoText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  cancelBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: spacing.borderRadius.md,
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1,
  },
  immediateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  immediateBtnText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginRight: 4,
  },
});
