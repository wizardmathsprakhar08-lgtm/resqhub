import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  EmergencyContact,
  SosState,
  LocationData,
  ActiveAlertSession,
} from '../../types';
import { getAllContacts, getContactsCount } from '../../database/db';
import { loadAppSettings, saveShakeSettings } from '../settings/settingsService';
import { getCurrentLocationWithTimeout } from '../location/locationService';
import {
  dispatchSosAlert,
  resolveAlertOnServer,
  fetchAlertStatus,
  openPhoneDialer,
} from './alertService';
import { subscribeToSmsDeliveryReports } from '../sms/directSmsService';
import { useShakeDetector } from './useShakeDetector';
import { ALERT_POLL_INTERVAL_MS } from '../../constants/timing';

// Global singleton alert session state across screens
let activeSession: ActiveAlertSession | null = null;
const sessionListeners: Set<(session: ActiveAlertSession | null) => void> = new Set();
let pollIntervalHandle: ReturnType<typeof setInterval> | null = null;
let deliveryReportUnsubscribe: (() => void) | null = null;

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

function notifySessionListeners() {
  const snapshot = cloneSession(activeSession);
  sessionListeners.forEach((l) => l(snapshot));
}

function stopStatusPolling() {
  if (pollIntervalHandle) {
    clearInterval(pollIntervalHandle);
    pollIntervalHandle = null;
  }
}

function startStatusPolling(alertId: string) {
  stopStatusPolling();
  if (alertId.startsWith('local_') || alertId.startsWith('pending_')) return;

  let pollCount = 0;
  pollIntervalHandle = setInterval(async () => {
    pollCount += 1;
    if (pollCount > 5 || !activeSession || activeSession.state === 'resolved') {
      stopStatusPolling();
      return;
    }

    const updated = await fetchAlertStatus(alertId);
    if (updated && activeSession && activeSession.alertId === alertId) {
      const nextState =
        updated.status === 'sent' || updated.status === 'partial_failure' || updated.status === 'mock' || updated.status === 'failed'
          ? (updated.status as SosState)
          : activeSession.state;

      activeSession = cloneSession({
        ...activeSession,
        state: nextState,
        recipients: updated.recipients,
      });
      notifySessionListeners();

      // If all recipients are in a final delivery state, stop polling early
      const allDone = updated.recipients.every(
        (r) => r.status === 'delivered' || r.status === 'failed' || r.status === 'sent' || r.status === 'mock'
      );
      if (allDone && pollCount >= 2) {
        stopStatusPolling();
      }
    }
  }, ALERT_POLL_INTERVAL_MS);
}

export function useSosMonitor() {
  const router = useRouter();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactsCount, setContactsCount] = useState<number>(0);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [session, setSession] = useState<ActiveAlertSession | null>(() => cloneSession(activeSession));
  const [showCountdown, setShowCountdown] = useState<boolean>(false);
  const isDispatchingRef = useRef<boolean>(false);

  // Derived state directly from singleton session so all screens stay 100% in sync
  const isLocating = session?.state === 'locating';
  const isSending = session?.state === 'sending';

  // Sync with global session singleton
  useEffect(() => {
    const listener = (newSession: ActiveAlertSession | null) => {
      setSession(newSession);
    };
    sessionListeners.add(listener);
    return () => {
      sessionListeners.delete(listener);
    };
  }, []);

  const refreshContacts = useCallback(() => {
    const list = getAllContacts();
    setContacts(list);
    setContactsCount(list.length);
    return list;
  }, []);

  useEffect(() => {
    refreshContacts();
    const settings = loadAppSettings();
    setIsMonitoring(settings.shakeEnabled);
  }, [refreshContacts]);

  const toggleMonitoring = useCallback((targetState?: boolean) => {
    const currentCount = getContactsCount();
    if (currentCount === 0) {
      return {
        success: false,
        error: 'Please register at least one emergency contact before starting monitoring.',
      };
    }

    const nextState = targetState !== undefined ? targetState : !isMonitoring;
    const settings = loadAppSettings();
    saveShakeSettings(nextState, settings.shakeSensitivity);
    setIsMonitoring(nextState);
    return { success: true };
  }, [isMonitoring]);

  // Initiate SOS workflow
  const triggerSos = useCallback(() => {
    const currentCount = getContactsCount();
    if (currentCount === 0) {
      return {
        success: false,
        error: 'Cannot trigger SOS without emergency contacts. Please add a contact first.',
      };
    }
    setShowCountdown(true);
    return { success: true };
  }, []);

  const cancelCountdown = useCallback(() => {
    setShowCountdown(false);
    isDispatchingRef.current = false;
  }, []);

  const executeSosDispatch = useCallback(async () => {
    // Idempotency guard: prevent duplicate executions from timer races, double-taps, or Strict Mode
    if (isDispatchingRef.current) {
      console.log('[ResQHub SOS] SOS dispatch already in progress, ignoring duplicate call');
      return;
    }
    isDispatchingRef.current = true;

    setShowCountdown(false);
    const savedContacts = getAllContacts();
    if (savedContacts.length === 0) {
      console.warn('[ResQHub SOS] No emergency contacts registered, aborting dispatch');
      isDispatchingRef.current = false;
      return;
    }

    try {
      const initialSession: ActiveAlertSession = {
        alertId: 'pending_' + Date.now(),
        idempotencyKey: 'idemp_' + Date.now(),
        state: 'locating',
        message: loadAppSettings().customMessage,
        recipients: savedContacts.map((c) => ({
          contactId: c.id,
          contactName: c.name,
          phoneNumber: c.number,
          status: 'queued',
        })),
        startedAt: Date.now(),
      };

      activeSession = cloneSession(initialSession);
      notifySessionListeners();

      // Navigate to active alert screen
      router.push('/alert/active');

      // Step 1: Locate with bounded timeout & last-known cached fallback
      let locationData: LocationData | undefined = undefined;
      try {
        console.log('[ResQHub SOS] Acquiring device location for emergency alert...');
        const locRes = await getCurrentLocationWithTimeout();
        if (locRes.success && locRes.data) {
          locationData = locRes.data;
          console.log(`[ResQHub SOS] Location fix acquired: ${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)} (cached=${!!locationData.isCached})`);
          if (activeSession) {
            // Update location immediately and re-render screen with coordinates/address
            activeSession = cloneSession({
              ...activeSession,
              location: locationData,
            });
            notifySessionListeners();
          }
        } else {
          console.warn(`[ResQHub SOS] Location fix unavailable: [${locRes.errorType || 'unknown'}] ${locRes.error || 'Timed out'}. Proceeding with location-unavailable alert.`);
        }
      } catch (e) {
        console.warn('[ResQHub SOS] Location retrieval exception:', e);
      }

      // Step 2: Send
      if (activeSession) {
        activeSession = cloneSession({
          ...activeSession,
          state: 'sending',
        });
        notifySessionListeners();
      }

      console.log(`[ResQHub SOS] Dispatched alert to backend gateway for ${savedContacts.length} contact(s)...`);
      const dispatchRes = await dispatchSosAlert(
        savedContacts,
        locationData,
        activeSession?.message
      );

      if (activeSession) {
        activeSession = cloneSession({
          ...activeSession,
          alertId: dispatchRes.alertId || activeSession.alertId,
          state: dispatchRes.status,
          recipients: dispatchRes.recipients,
          error: dispatchRes.error,
        });
        notifySessionListeners();

        // Poll delivery status from backend if dispatch succeeded (and not mock)
        if (dispatchRes.success && dispatchRes.alertId && dispatchRes.status !== 'mock') {
          startStatusPolling(dispatchRes.alertId);
        }

        // Listen to native carrier delivery callbacks for physical SIM dispatches
        if (deliveryReportUnsubscribe) {
          deliveryReportUnsubscribe();
          deliveryReportUnsubscribe = null;
        }

        deliveryReportUnsubscribe = subscribeToSmsDeliveryReports(
          (recipientId, phoneNumber) => {
            if (activeSession) {
              console.log(`[ResQHub SMS] Carrier confirmed delivery to ${phoneNumber}`);
              const updatedRecipients = activeSession.recipients.map((r) =>
                r.contactId === recipientId || r.phoneNumber === phoneNumber
                  ? { ...r, status: 'delivered' as const }
                  : r
              );
              activeSession = cloneSession({
                ...activeSession,
                recipients: updatedRecipients,
              });
              notifySessionListeners();
            }
          },
          (recipientId, phoneNumber, error) => {
            if (activeSession) {
              console.warn(`[ResQHub SMS] Carrier delivery error for ${phoneNumber}: ${error}`);
              const updatedRecipients = activeSession.recipients.map((r) =>
                r.contactId === recipientId || r.phoneNumber === phoneNumber
                  ? { ...r, status: 'failed' as const, errorMessage: error }
                  : r
              );
              activeSession = cloneSession({
                ...activeSession,
                recipients: updatedRecipients,
              });
              notifySessionListeners();
            }
          }
        );
      }
    } catch (err) {
      console.error('[ResQHub SOS] Fatal error during SOS dispatch:', err);
    } finally {
      isDispatchingRef.current = false;
    }
  }, [router]);

  const retryDispatch = useCallback(async () => {
    if (!activeSession) return;
    const savedContacts = getAllContacts();
    if (savedContacts.length === 0) return;

    const loc = activeSession.location;
    const msg = activeSession.message;

    activeSession = cloneSession({
      ...activeSession,
      state: 'sending',
      error: undefined,
    });
    notifySessionListeners();

    const dispatchRes = await dispatchSosAlert(
      savedContacts,
      loc,
      msg
    );

    if (activeSession) {
      activeSession = cloneSession({
        ...activeSession,
        alertId: dispatchRes.alertId || activeSession.alertId,
        state: dispatchRes.status,
        recipients: dispatchRes.recipients,
        error: dispatchRes.error,
      });
      notifySessionListeners();

      if (dispatchRes.success && dispatchRes.alertId && dispatchRes.status !== 'mock') {
        startStatusPolling(dispatchRes.alertId);
      }
    }
  }, []);

  const retryLocation = useCallback(async (): Promise<boolean> => {
    if (!activeSession) return false;
    const prevState = activeSession.state;
    activeSession = cloneSession({
      ...activeSession,
      state: 'locating',
    });
    notifySessionListeners();

    try {
      const locRes = await getCurrentLocationWithTimeout({ timeoutMs: 8000, allowCachedFallback: true });
      if (locRes.success && locRes.data) {
        if (activeSession) {
          activeSession = cloneSession({
            ...activeSession,
            state: prevState !== 'locating' ? prevState : 'sent',
            location: locRes.data,
          });
          notifySessionListeners();
        }
        return true;
      }
      if (activeSession) {
        activeSession = cloneSession({
          ...activeSession,
          state: prevState,
        });
        notifySessionListeners();
      }
      return false;
    } catch {
      if (activeSession) {
        activeSession = cloneSession({
          ...activeSession,
          state: prevState,
        });
        notifySessionListeners();
      }
      return false;
    }
  }, []);

  const callPrimaryEmergencyNumber = useCallback(async () => {
    const settings = loadAppSettings();
    const primaryNumber = settings.primaryEmergencyNumber || '112';
    await openPhoneDialer(primaryNumber);
  }, []);

  const resolveAlert = useCallback(async (reason: string = 'Safe now') => {
    stopStatusPolling();
    if (deliveryReportUnsubscribe) {
      deliveryReportUnsubscribe();
      deliveryReportUnsubscribe = null;
    }
    isDispatchingRef.current = false;
    if (activeSession?.alertId) {
      await resolveAlertOnServer(activeSession.alertId, reason);
      activeSession = cloneSession({
        ...activeSession,
        state: 'resolved',
        resolvedAt: Date.now(),
      });
      notifySessionListeners();
    }
  }, []);

  const clearSession = useCallback(() => {
    stopStatusPolling();
    if (deliveryReportUnsubscribe) {
      deliveryReportUnsubscribe();
      deliveryReportUnsubscribe = null;
    }
    isDispatchingRef.current = false;
    activeSession = null;
    notifySessionListeners();
  }, []);

  // Hook shake detector: triggers countdown when shake is detected & monitoring is enabled
  useShakeDetector({
    enabled: isMonitoring && !showCountdown && activeSession?.state !== 'sending' && activeSession?.state !== 'locating',
    sensitivity: loadAppSettings().shakeSensitivity,
    onShake: () => {
      triggerSos();
    },
  });

  return {
    contacts,
    contactsCount,
    isMonitoring,
    session,
    showCountdown,
    isLocating,
    isSending,
    refreshContacts,
    toggleMonitoring,
    triggerSos,
    cancelCountdown,
    executeSosDispatch,
    retryDispatch,
    retryLocation,
    callPrimaryEmergencyNumber,
    resolveAlert,
    clearSession,
  };
}
