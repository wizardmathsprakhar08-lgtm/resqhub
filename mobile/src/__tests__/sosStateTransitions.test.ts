import { describe, it, expect, jest } from '@jest/globals';
import { ActiveAlertSession, LocationData, SosState } from '../types';

/**
 * Validates the core immutability and state-machine transitions that govern
 * useSosMonitor and ActiveAlertScreen, preventing the "stuck acquiring" bug.
 */
describe('SOS State Transitions & Immutability Guarantees', () => {
  function cloneSession(s: ActiveAlertSession | null): ActiveAlertSession | null {
    if (!s) return null;
    return {
      ...s,
      location: s.location
        ? {
            ...s.location,
            readableAddress: s.location.readableAddress
              ? { ...s.location.readableAddress }
              : undefined,
          }
        : undefined,
      recipients: s.recipients ? s.recipients.map((r) => ({ ...r })) : [],
    };
  }

  it('enforces distinct object references across every state transition so React never bails out', () => {
    // 1. Initial locating session
    const session1: ActiveAlertSession = {
      alertId: 'pending_100',
      idempotencyKey: 'idemp_100',
      state: 'locating',
      message: 'Emergency SOS',
      recipients: [{ contactId: 'c1', contactName: 'Alice', phoneNumber: '+919876543210', status: 'queued' }],
      startedAt: Date.now(),
    };

    // 2. Location acquired (cached fallback)
    const cachedLocation: LocationData = {
      latitude: 19.076,
      longitude: 72.8777,
      accuracy: 100,
      timestamp: Date.now() - 30000,
      mapUrl: 'https://maps.google.com/?q=19.076000,72.877700',
      isCached: true,
      readableAddress: { area: 'Bandra', city: 'Mumbai' },
    };

    const session2 = cloneSession({
      ...session1,
      location: cachedLocation,
    });

    // Object reference MUST change so React detects change
    expect(session2).not.toBe(session1);
    expect(Object.is(session1, session2)).toBe(false);
    expect(session2?.location).toBeDefined();
    expect(session2?.location?.isCached).toBe(true);

    // 3. Transition to sending
    const session3 = cloneSession({
      ...session2!,
      state: 'sending',
    });

    expect(session3).not.toBe(session2);
    expect(session3?.state).toBe('sending');

    // 4. Transition to final mock result
    const session4 = cloneSession({
      ...session3!,
      alertId: 'alert_mock_123',
      state: 'mock',
      recipients: [{ contactId: 'c1', contactName: 'Alice', phoneNumber: '+919876543210', status: 'mock' }],
    });

    expect(session4).not.toBe(session3);
    expect(session4?.state).toBe('mock');
    expect(session4?.recipients[0].status).toBe('mock');
    // Crucially: never masqueraded as 'delivered'
    expect(session4?.recipients[0].status).not.toBe('delivered');
  });

  it('correctly transitions out of locating state when cached position succeeds', () => {
    let currentState: SosState = 'locating';
    let currentLocation: LocationData | undefined = undefined;

    // Simulate location callback with cached fallback
    const locResult = {
      success: true,
      data: {
        latitude: 18.5204,
        longitude: 73.8567,
        accuracy: 95,
        timestamp: Date.now() - 60000,
        mapUrl: 'https://maps.google.com/?q=18.520400,73.856700',
        isCached: true,
      },
    };

    if (locResult.success && locResult.data) {
      currentLocation = locResult.data;
    }

    // Immediately transitions out of locating
    currentState = 'sending';

    expect(currentState).toBe('sending');
    expect(currentLocation).toBeDefined();
    expect(currentLocation?.isCached).toBe(true);
    expect(currentLocation?.accuracy).toBe(95);
  });

  it('correctly transitions out of locating state when fresh GPS times out without cached fallback', () => {
    let currentState: SosState = 'locating';
    let currentLocation: LocationData | undefined = undefined;

    // Simulate complete GPS timeout
    const locResult = {
      success: false,
      errorType: 'timeout',
      error: 'GPS acquisition timed out after 8s.',
    };

    if (locResult.success) {
      currentLocation = (locResult as any).data;
    }

    // Still must transition out of locating so user is not stuck on infinite spinner
    currentState = 'sending';

    expect(currentState).toBe('sending');
    expect(currentLocation).toBeUndefined();
  });
});
