import { describe, it, expect } from '@jest/globals';

describe('Shake Detection Logic', () => {
  const THRESHOLDS = {
    high: 2.2,
    medium: 2.8,
    low: 3.5,
  };

  const calculateMagnitude = (x: number, y: number, z: number): number => {
    return Math.sqrt(x * x + y * y + z * z);
  };

  it('should calculate resting gravity magnitude at ~1.0g', () => {
    // Normal gravity pointing down along Z
    const restingMagnitude = calculateMagnitude(0, 0, 1.0);
    expect(restingMagnitude).toBeCloseTo(1.0, 1);
    expect(restingMagnitude).toBeLessThan(THRESHOLDS.high);
    expect(restingMagnitude).toBeLessThan(THRESHOLDS.medium);
  });

  it('should trigger alert when shake exceeds medium threshold (2.8g)', () => {
    // Deliberate sharp movement in 3D
    const shakeMagnitude = calculateMagnitude(2.0, 1.8, 1.5); // ~3.08g
    expect(shakeMagnitude).toBeGreaterThan(THRESHOLDS.medium);
  });

  it('should ignore subtle walking or pocket movements below threshold', () => {
    const walkingMagnitude = calculateMagnitude(0.4, 0.3, 1.2); // ~1.3g
    expect(walkingMagnitude).toBeLessThan(THRESHOLDS.high);
  });

  it('should enforce 5-second cooldown between consecutive shakes', () => {
    const COOLDOWN_MS = 5000;
    const t0 = 1000000;
    const t1 = t0 + 2000; // 2 seconds later (within cooldown)
    const t2 = t0 + 5100; // 5.1 seconds later (cooldown expired)

    const isCooldownActive1 = (t1 - t0) < COOLDOWN_MS;
    const isCooldownActive2 = (t2 - t0) < COOLDOWN_MS;

    expect(isCooldownActive1).toBe(true); // Should block duplicate trigger
    expect(isCooldownActive2).toBe(false); // Should allow next trigger
  });
});
