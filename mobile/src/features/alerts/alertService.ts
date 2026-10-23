import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import {
  EmergencyContact,
  LocationData,
  ActiveAlertSession,
  RecipientDispatchStatus,
} from '../../types';
import {
  loadAppSettings,
  getApiKey,
  getDeviceId,
  normalizeBackendUrl,
} from '../settings/settingsService';
import { formatEmergencyLocationMessage } from '../location/locationService';
import { saveAlertHistory, updateAlertStatus } from '../../database/db';
import { BACKEND_REQUEST_TIMEOUT_MS } from '../../constants/timing';
import { sendEmergencySmsViaSim } from '../sms/directSmsService';

export interface DispatchResult {
  success: boolean;
  alertId?: string;
  status: 'sent' | 'mock' | 'partial_failure' | 'failed';
  recipients: RecipientDispatchStatus[];
  error?: string;
  errorCategory?: 'network_failure' | 'timeout' | 'auth_failure' | 'backend_rejection' | 'provider_failure' | 'unknown';
  isOfflineFallback?: boolean;
}

/**
 * Dispatches an emergency SOS alert.
 * Primary channel: Direct cellular SIM SMS via Android's SmsManager.
 * Secondary/sync: Records the alert in the backend ledger and local SQLite.
 */
export async function dispatchSosAlert(
  contacts: EmergencyContact[],
  location?: LocationData,
  customMessage?: string
): Promise<DispatchResult> {
  const settings = loadAppSettings();
  const baseUrl = normalizeBackendUrl(settings.backendUrl);
  const deviceId = await getDeviceId();
  const apiKey = await getApiKey();

  // Construct standardized message containing coordinates, maps link, timestamp, and accuracy
  const rawCustom = customMessage || settings.customMessage;
  const fullFormattedMessage = formatEmergencyLocationMessage(rawCustom, location);

  const idempotencyKey = `sos_${deviceId}_${Date.now()}`;
  const deliveryMethod = settings.smsDeliveryMethod || 'sim';

  // ==========================================
  // PRIMARY DISPATCH: Direct Cellular SIM SMS
  // ==========================================
  if (deliveryMethod === 'sim') {
    console.log(
      `[ResQHub SOS] Initiating DIRECT CELLULAR SIM SMS for ${contacts.length} recipient(s)...`
    );

    // 1. Dispatch SMS directly via Android SmsManager
    const simResult = await sendEmergencySmsViaSim(
      contacts,
      fullFormattedMessage,
      idempotencyKey
    );

    // 2. Synchronize alert record with backend ledger (non-blocking for SMS dispatch)
    let backendAlertId: string | undefined = undefined;
    let isSynchronized = false;
    try {
      const recipientPayload = simResult.results.map((r) => ({
        contact_name: r.contactName,
        phone_number: r.phoneNumber,
        delivery_status: r.status,
        error_message: r.errorMessage,
      }));

      const requestBody = {
        idempotency_key: idempotencyKey,
        sender_device_id: deviceId,
        message: fullFormattedMessage,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        map_url: location?.mapUrl ?? null,
        channel: 'sim',
        recipients: recipientPayload,
      };

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`${baseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutHandle);

      if (response.ok) {
        const data = await response.json();
        backendAlertId = data.id;
        isSynchronized = true;
        console.log(
          `[ResQHub SOS] Direct SIM alert synchronized with backend ledger. Alert ID: ${data.id}`
        );
      } else {
        console.warn(
          `[ResQHub SOS] Backend ledger returned HTTP ${response.status}. Alert preserved locally in SQLite.`
        );
      }
    } catch (syncErr: any) {
      const isAborted =
        syncErr?.name === 'AbortError' ||
        syncErr?.message?.toLowerCase().includes('canceled') ||
        syncErr?.message?.toLowerCase().includes('cancelled') ||
        syncErr?.message?.toLowerCase().includes('aborted');

      if (isAborted) {
        console.warn(
          `[ResQHub SOS] Backend ledger sync timed out reaching ${baseUrl}. Alert preserved locally in SQLite.`
        );
      } else {
        console.warn(
          `[ResQHub SOS] Backend ledger sync unavailable (${syncErr?.message || syncErr}). Alert preserved locally in SQLite.`
        );
      }
    }

    const effectiveAlertId = backendAlertId || `local_sim_${Date.now()}`;
    const overallStatus: DispatchResult['status'] = simResult.allSucceeded
      ? 'sent'
      : simResult.anySucceeded
      ? 'partial_failure'
      : 'failed';

    // 3. Persist alert record to local SQLite database with synced status
    saveAlertHistory({
      id: effectiveAlertId,
      idempotencyKey,
      status: overallStatus,
      message: fullFormattedMessage,
      latitude: location?.latitude,
      longitude: location?.longitude,
      mapUrl: location?.mapUrl,
      recipientsCount: contacts.length,
      synced: isSynchronized,
    });

    console.log(
      `[ResQHub SOS] Direct SIM dispatch result: ${overallStatus} (${
        simResult.results.filter((r) => r.status === 'sent').length
      }/${contacts.length} accepted by carrier). Reason: ${
        simResult.summaryError || 'Accepted by cellular baseband'
      }`
    );

    simResult.results.forEach((r, idx) => {
      console.log(
        `[ResQHub SOS] Recipient #${idx + 1} (${r.contactName}): status=${r.status}${
          r.errorMessage ? `, reason=${r.errorMessage}` : ''
        }`
      );
    });

    return {
      success: simResult.anySucceeded,
      alertId: effectiveAlertId,
      status: overallStatus,
      recipients: simResult.results,
      error: simResult.summaryError,
      errorCategory: !simResult.anySucceeded ? 'provider_failure' : undefined,
      isOfflineFallback: !backendAlertId,
    };
  }

  // 1. Prepare recipients list
  const recipientPayload = contacts.map((c) => ({
    contact_name: c.name,
    phone_number: c.number,
  }));

  const requestBody = {
    idempotency_key: idempotencyKey,
    sender_device_id: deviceId,
    message: fullFormattedMessage,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    map_url: location?.mapUrl ?? null,
    recipients: recipientPayload,
  };

  // Structured privacy-safe logging
  console.log(
    `[ResQHub SOS] Initiating alert dispatch for ${contacts.length} recipient(s) to ${baseUrl}/alerts`
  );

  let controller: AbortController | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    controller = new AbortController();
    timeoutHandle = setTimeout(() => {
      if (controller) {
        controller.abort();
      }
    }, BACKEND_REQUEST_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (timeoutHandle) clearTimeout(timeoutHandle);

    if (response.ok) {
      const data = await response.json();
      const recipients: RecipientDispatchStatus[] = (data.recipients || []).map((r: any) => ({
        contactId: r.id,
        contactName: r.contact_name,
        phoneNumber: r.phone_number,
        status: r.delivery_status || 'sent',
        errorMessage: r.error_message,
      }));

      // Persist to local SQLite history
      saveAlertHistory({
        id: data.id,
        idempotencyKey,
        status: data.status,
        message: fullFormattedMessage,
        latitude: location?.latitude,
        longitude: location?.longitude,
        mapUrl: location?.mapUrl,
        recipientsCount: recipients.length,
      });

      console.log(`[ResQHub SOS] Dispatch accepted by backend. Alert ID: ${data.id}, Status: ${data.status}`);
      recipients.forEach((r) => {
        console.log(`[ResQHub SOS] Recipient: ${r.contactName} (${r.phoneNumber}) -> ${r.status}${r.errorMessage ? ` (${r.errorMessage})` : ''}`);
      });

      const isFailed = data.status === 'failed';
      const isPartial = data.status === 'partial_failure';
      const isMock = data.status === 'mock';

      const firstError = recipients.find((r) => r.errorMessage)?.errorMessage;
      const failureError = isFailed
        ? (firstError || 'SMS delivery failed for all emergency contacts.')
        : isPartial
        ? (firstError || 'SMS delivery failed for some emergency contacts.')
        : undefined;

      return {
        success: !isFailed,
        alertId: data.id,
        status: isFailed ? 'failed' : isMock ? 'mock' : isPartial ? 'partial_failure' : 'sent',
        recipients,
        error: failureError,
        errorCategory: isFailed ? 'provider_failure' : undefined,
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      const statusCode = response.status;
      let errorCategory: DispatchResult['errorCategory'] = 'backend_rejection';
      let errorMsg = errorData.detail || `Server returned ${statusCode}`;

      if (statusCode === 401) {
        errorCategory = 'auth_failure';
        errorMsg = 'API Key unauthorized by backend. Check settings.';
      } else if (statusCode === 422) {
        errorCategory = 'backend_rejection';
        errorMsg = `Validation error from server: ${JSON.stringify(errorData.detail || '')}`;
      }

      throw {
        isHttpError: true,
        category: errorCategory,
        message: errorMsg,
      };
    }
  } catch (err: any) {
    if (timeoutHandle) clearTimeout(timeoutHandle);

    let errorCategory: DispatchResult['errorCategory'] = 'network_failure';
    let errorMessage = err?.message || 'Could not connect to emergency server.';

    if (err.category) {
      errorCategory = err.category;
      errorMessage = err.message;
    } else if (
      err.name === 'AbortError' ||
      errorMessage.toLowerCase().includes('aborted') ||
      errorMessage.toLowerCase().includes('cancelled')
    ) {
      errorCategory = 'timeout';
      errorMessage = `Server request timed out after ${Math.round(
        BACKEND_REQUEST_TIMEOUT_MS / 1000
      )}s. Verify that ${baseUrl} is reachable from your device network.`;
    } else if (errorMessage.toLowerCase().includes('failed to fetch') || errorMessage.toLowerCase().includes('network request failed')) {
      errorCategory = 'network_failure';
      errorMessage = `Cannot reach backend at ${baseUrl}. Ensure backend server is running and accessible over LAN.`;
    }

    console.warn(`[ResQHub SOS] Backend dispatch failed [${errorCategory}]:`, errorMessage);

    // Fallback recipient records marked as failed/offline
    const fallbackRecipients: RecipientDispatchStatus[] = contacts.map((c) => ({
      contactId: c.id,
      contactName: c.name,
      phoneNumber: c.number,
      status: 'failed',
      errorMessage: errorMessage,
    }));

    // Record local failure entry in SQLite
    const localId = 'local_' + Date.now();
    saveAlertHistory({
      id: localId,
      idempotencyKey,
      status: 'failed',
      message: fullFormattedMessage,
      latitude: location?.latitude,
      longitude: location?.longitude,
      mapUrl: location?.mapUrl,
      recipientsCount: contacts.length,
    });

    return {
      success: false,
      alertId: localId,
      status: 'failed',
      recipients: fallbackRecipients,
      error: errorMessage,
      errorCategory,
      isOfflineFallback: true,
    };
  }
}

/**
 * Polls the current alert and recipient delivery statuses from the backend.
 */
export async function fetchAlertStatus(alertId: string): Promise<{
  status: string;
  recipients: RecipientDispatchStatus[];
} | null> {
  if (alertId.startsWith('local_') || alertId.startsWith('pending_')) {
    return null;
  }

  const settings = loadAppSettings();
  const baseUrl = normalizeBackendUrl(settings.backendUrl);
  const apiKey = await getApiKey();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl}/alerts/${alertId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-Key': apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const recipients: RecipientDispatchStatus[] = (data.recipients || []).map((r: any) => ({
        contactId: r.id,
        contactName: r.contact_name,
        phoneNumber: r.phone_number,
        status: r.delivery_status || 'sent',
        errorMessage: r.error_message,
      }));

      return {
        status: data.status,
        recipients,
      };
    }
  } catch (e) {
    // Polling failure is non-fatal
  }
  return null;
}

/**
 * Resolves an active emergency alert on the server.
 */
export async function resolveAlertOnServer(
  alertId: string,
  reason: string = 'Safe now'
): Promise<boolean> {
  const settings = loadAppSettings();
  const baseUrl = normalizeBackendUrl(settings.backendUrl);
  const apiKey = await getApiKey();
  const deviceId = await getDeviceId();

  try {
    updateAlertStatus(alertId, 'resolved', new Date().toISOString());

    if (!alertId.startsWith('local_') && !alertId.startsWith('pending_')) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      await fetch(`${baseUrl}/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ reason, sender_device_id: deviceId }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    }
    return true;
  } catch (err) {
    console.error('Error resolving alert on server:', err);
    return false;
  }
}

/**
 * Opens the native SMS composer on the device as an offline fallback.
 * NOTE: Due to Android and iOS security policies, third-party apps cannot silently send SMS.
 * The SMS composer opens with the emergency text prefilled and requires the user to tap Send.
 */
export async function openNativeSmsFallback(
  contacts: EmergencyContact[],
  message: string,
  mapUrl?: string
): Promise<void> {
  const bodyText = mapUrl && !message.includes(mapUrl)
    ? `${message}\n\nCoordinates:\n${mapUrl}`
    : message;
  const encodedBody = encodeURIComponent(bodyText);

  // Comma-separated on Android, ampersand-separated on iOS
  const phoneNumbers = contacts.map((c) => c.number.replace(/\s+/g, '')).join(Platform.OS === 'ios' ? '&' : ',');
  const smsUrl = Platform.OS === 'ios'
    ? `sms:${phoneNumbers}&body=${encodedBody}`
    : `sms:${phoneNumbers}?body=${encodedBody}`;

  try {
    const supported = await Linking.canOpenURL(smsUrl);
    if (supported) {
      await Linking.openURL(smsUrl);
    } else {
      await Linking.openURL(`sms:?body=${encodedBody}`);
    }
  } catch (e) {
    console.error('Failed to open SMS composer:', e);
  }
}

/**
 * Opens the system telephone dialer with the specified number.
 * Note: Under standard Android permissions, `tel:` opens the system dialer (ACTION_DIAL).
 * Bypassing the dialer for emergency numbers (112, 911) is restricted by Android OS.
 */
export async function openPhoneDialer(phoneNumber: string): Promise<void> {
  const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
  const telUrl = `tel:${cleanNumber}`;
  try {
    await Linking.openURL(telUrl);
  } catch (err) {
    console.error('Failed to open phone dialer:', err);
  }
}

export interface SmsDiagnosticsResult {
  success: boolean;
  mockMode?: boolean;
  twilioInstalled?: boolean;
  accountSidConfigured?: boolean;
  authTokenConfigured?: boolean;
  fromNumberConfigured?: boolean;
  maskedFromNumber?: string | null;
  configurationStatus?: 'mock_mode' | 'live_ready' | 'unconfigured';
  guidance?: string;
  lastDispatch?: {
    alertId?: string;
    status?: string;
    createdAt?: string;
    recipientCount?: number;
    statuses?: Array<{
      delivery_status: string;
      error_message?: string;
      provider_message_sid?: string;
    }>;
  };
  error?: string;
}

/**
 * Fetches safe server diagnostics on SMS provider readiness without exposing credentials.
 */
export async function fetchSmsDiagnostics(): Promise<SmsDiagnosticsResult> {
  const settings = loadAppSettings();
  const baseUrl = normalizeBackendUrl(settings.backendUrl);
  const apiKey = await getApiKey();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${baseUrl}/alerts/diagnostics/sms`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        mockMode: data.mock_mode,
        twilioInstalled: data.twilio_installed,
        accountSidConfigured: data.account_sid_configured,
        authTokenConfigured: data.auth_token_configured,
        fromNumberConfigured: data.from_number_configured,
        maskedFromNumber: data.masked_from_number,
        configurationStatus: data.configuration_status,
        guidance: data.guidance,
        lastDispatch: data.last_dispatch
          ? {
              alertId: data.last_dispatch.alert_id,
              status: data.last_dispatch.status,
              createdAt: data.last_dispatch.created_at,
              recipientCount: data.last_dispatch.recipient_count,
              statuses: data.last_dispatch.statuses,
            }
          : undefined,
      };
    } else {
      return {
        success: false,
        error: `Server responded with HTTP ${response.status}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Cannot reach server diagnostics endpoint',
    };
  }
}
