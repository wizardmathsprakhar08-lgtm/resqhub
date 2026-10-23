import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';

interface ShakeDetectorOptions {
  enabled: boolean;
  sensitivity?: 'low' | 'medium' | 'high';
  cooldownMs?: number;
  onShake: () => void;
}

// In Expo Sensors, values are normalized in units of Earth's gravity (1g ≈ 9.81 m/s²).
// At rest, magnitude is ~1.0g.
const THRESHOLDS = {
  high: 2.2,    // Sensitive shake
  medium: 2.8,  // Standard deliberate shake
  low: 3.5,     // Strong intentional shake
};

const DEFAULT_COOLDOWN_MS = 5000; // 5-second cooldown as specified in reference app

export function useShakeDetector({
  enabled,
  sensitivity = 'medium',
  cooldownMs = DEFAULT_COOLDOWN_MS,
  onShake,
}: ShakeDetectorOptions) {
  const lastShakeTimeRef = useRef<number>(0);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!enabled) return;

    let subscription: { remove: () => void } | null = null;
    const threshold = THRESHOLDS[sensitivity] || THRESHOLDS.medium;

    Accelerometer.setUpdateInterval(100); // 10Hz sampling

    subscription = Accelerometer.addListener(({ x, y, z }) => {
      // Acceleration magnitude in g's
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      if (magnitude > threshold) {
        const now = Date.now();
        if (now - lastShakeTimeRef.current > cooldownMs) {
          lastShakeTimeRef.current = now;

          // Haptic alert
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch {
            // Ignore if haptics unavailable
          }

          // Trigger callback
          onShakeRef.current();
        }
      }
    });

    return () => {
      if (subscription) {
        subscription.remove();
        subscription = null;
      }
    };
  }, [enabled, sensitivity, cooldownMs]);
}
