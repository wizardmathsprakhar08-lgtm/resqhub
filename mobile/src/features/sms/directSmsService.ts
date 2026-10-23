import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { EmergencyContact, RecipientDispatchStatus } from '../../types';

function resolveDirectSmsModule(): any {
  if (NativeModules?.DirectSms) {
    return NativeModules.DirectSms;
  }
  try {
    // Attempt dynamic resolution in runtime environments where expo-modules-core is present
    const core = require('expo-modules-core');
    if (typeof core?.requireOptionalNativeModule === 'function') {
      const mod = core.requireOptionalNativeModule('DirectSms');
      if (mod) return mod;
    }
  } catch {
    // Graceful fallback for environments like Jest without expo-modules-core transform
  }
  return (globalThis as any)?.expo?.modules?.DirectSms || null;
}

const DirectSms = resolveDirectSmsModule();
const smsEventEmitter = DirectSms ? new NativeEventEmitter(DirectSms) : null;

export interface SmsCapabilityResult {
  supported: boolean;
  isExpoGo: boolean;
  hasTelephony: boolean;
  simState: 'READY' | 'ABSENT' | 'LOCKED' | 'UNKNOWN';
  permissionGranted: boolean;
  isReady: boolean;
  isDualSim: boolean;
  activeSimCount: number;
  carrierNames: string[];
  error?: string;
}

export interface DirectSmsSubmitResult {
  success: boolean;
  alertId: string;
  recipientId: string;
  phoneNumber: string;
  status: 'sent' | 'submitting' | 'failed';
  error?: string;
  errorCode?: number;
  partsCount?: number;
}

/**
 * Checks whether the current runtime environment is Expo Go.
 * Native Kotlin modules (DirectSms) cannot run inside standard Expo Go.
 */
export function isRunningInExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo'
  );
}

/**
 * Checks whether the app currently holds android.permission.SEND_SMS.
 */
export async function checkSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS);
  } catch (err) {
    console.warn('[ResQHub SMS] Permission check error:', err);
    return false;
  }
}

/**
 * Requests the android.permission.SEND_SMS runtime permission from the user
 * with a clear emergency-safety rationale dialog.
 */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  console.log('[ResQHub SMS Diagnostics] Requesting android.permission.SEND_SMS from user...');
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: 'Emergency SMS Permission',
        message:
          'ResQHub needs permission to send direct emergency SMS messages from your phone SIM to your saved emergency contacts when SOS is triggered.',
        buttonPositive: 'Allow Emergency SMS',
        buttonNegative: 'Deny',
      }
    );
    const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
    console.log(
      `[ResQHub SMS Diagnostics] User permission dialog result: ${granted} (isGranted=${isGranted})`
    );
    return isGranted;
  } catch (err) {
    console.warn('[ResQHub SMS Diagnostics] Permission request exception:', err);
    return false;
  }
}

/**
 * Probes device hardware, SIM status, dual-SIM configuration, and SMS capability.
 */
export async function checkSmsCapability(): Promise<SmsCapabilityResult> {
  const isExpoGo = isRunningInExpoGo();
  const isModuleLinked = !!DirectSms;

  console.log(`[ResQHub SMS Diagnostics] Probing Runtime Environment:
    - Platform: ${Platform.OS}
    - Is Expo Go Client: ${isExpoGo}
    - Execution Environment: ${Constants.executionEnvironment || 'bare'}
    - App Ownership: ${Constants.appOwnership || 'standalone'}
    - Native DirectSms Module Linked: ${isModuleLinked}`);

  if (Platform.OS !== 'android') {
    return {
      supported: false,
      isExpoGo: false,
      hasTelephony: false,
      simState: 'UNKNOWN',
      permissionGranted: false,
      isReady: false,
      isDualSim: false,
      activeSimCount: 0,
      carrierNames: [],
      error: 'Direct SIM SMS is only supported on Android devices.',
    };
  }

  if (isExpoGo) {
    console.warn(
      '[ResQHub SMS Diagnostics] Custom native module DirectSms cannot run inside Expo Go. Install development build APK.'
    );
    return {
      supported: false,
      isExpoGo: true,
      hasTelephony: true,
      simState: 'UNKNOWN',
      permissionGranted: false,
      isReady: false,
      isDualSim: false,
      activeSimCount: 0,
      carrierNames: [],
      error:
        'Direct SIM SMS requires the ResQHub development build (custom native module). In Expo Go, manual SMS composer fallback will be used.',
    };
  }

  if (!isModuleLinked) {
    console.warn(
      '[ResQHub SMS Diagnostics] DirectSms native module is not linked in this build. Verify that the installed APK was built with the custom DirectSms module.'
    );
    return {
      supported: false,
      isExpoGo: false,
      hasTelephony: true,
      simState: 'UNKNOWN',
      permissionGranted: false,
      isReady: false,
      isDualSim: false,
      activeSimCount: 0,
      carrierNames: [],
      error:
        'DirectSms native module is not linked in this Android build. Fallback composer available.',
    };
  }

  try {
    const nativeResult = await DirectSms.checkSmsCapability();
    console.log(`[ResQHub SMS Diagnostics] Native Capability Result:
    - Telephony Hardware: ${nativeResult.hasTelephony}
    - SIM Card State: ${nativeResult.simState}
    - SEND_SMS Permission Granted: ${nativeResult.permissionGranted}
    - Is Ready For SMS: ${nativeResult.isReady}
    - Active SIM Count: ${nativeResult.activeSimCount || 0}
    - Dual SIM: ${nativeResult.isDualSim}
    - Default SMS Subscription ID: ${nativeResult.defaultSmsSubscriptionId}`);

    return {
      supported: true,
      isExpoGo: false,
      hasTelephony: !!nativeResult.hasTelephony,
      simState: nativeResult.simState || 'UNKNOWN',
      permissionGranted: !!nativeResult.permissionGranted,
      isReady: !!nativeResult.isReady,
      isDualSim: !!nativeResult.isDualSim,
      activeSimCount: nativeResult.activeSimCount || 0,
      carrierNames: nativeResult.carrierNames || [],
      error: nativeResult.error,
    };
  } catch (err: any) {
    console.warn('[ResQHub SMS Diagnostics] Native inspection error:', err);
    return {
      supported: false,
      isExpoGo: false,
      hasTelephony: false,
      simState: 'UNKNOWN',
      permissionGranted: false,
      isReady: false,
      isDualSim: false,
      activeSimCount: 0,
      carrierNames: [],
      error: `Failed to inspect SMS capability: ${err?.message || 'Unknown native error'}`,
    };
  }
}

/**
 * Submits an SMS to a single emergency contact via Android SmsManager.
 */
export async function sendDirectSmsToContact(
  contact: EmergencyContact,
  message: string,
  alertId: string
): Promise<DirectSmsSubmitResult> {
  const isExpoGo = isRunningInExpoGo();
  const isModuleLinked = !!DirectSms;

  if (Platform.OS !== 'android' || isExpoGo || !isModuleLinked) {
    const unavailReason = isExpoGo
      ? 'Direct native SMS requires the Expo development build. Use manual SMS composer.'
      : !isModuleLinked
      ? 'Direct native SMS module is not linked in this binary. Use manual SMS composer.'
      : 'Direct SIM SMS is only supported on Android.';
    console.warn(`[ResQHub SMS Diagnostics] Cannot send SIM SMS: ${unavailReason}`);
    return {
      success: false,
      alertId,
      recipientId: contact.id,
      phoneNumber: contact.number,
      status: 'failed',
      error: unavailReason,
    };
  }

  try {
    const res = await DirectSms.sendDirectSms(
      contact.number,
      message,
      alertId,
      contact.id
    );

    console.log(
      `[ResQHub SMS Diagnostics] Contact ID ${contact.id} submitted to baseband: parts=${res.partsCount || 1}`
    );

    return {
      success: true,
      alertId,
      recipientId: contact.id,
      phoneNumber: contact.number,
      status: 'sent',
      partsCount: res.partsCount || 1,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Device SIM failed to submit SMS';
    const errorCode = err?.code || 'UNKNOWN';
    console.warn(
      `[ResQHub SMS Diagnostics] Contact ID ${contact.id} submission rejected: [${errorCode}] ${errorMsg}`
    );
    return {
      success: false,
      alertId,
      recipientId: contact.id,
      phoneNumber: contact.number,
      status: 'failed',
      error: `[${errorCode}] ${errorMsg}`,
      errorCode,
    };
  }
}

/**
 * Submits direct emergency SMS messages to all saved emergency contacts
 * using the device's physical SIM card and tracks per-recipient results.
 */
export async function sendEmergencySmsViaSim(
  contacts: EmergencyContact[],
  message: string,
  alertId: string
): Promise<{
  results: RecipientDispatchStatus[];
  allSucceeded: boolean;
  anySucceeded: boolean;
  summaryError?: string;
}> {
  // 1. Check capability & permissions
  const capability = await checkSmsCapability();

  if (!capability.supported) {
    const err = capability.error || 'Direct SIM SMS is not supported in this runtime.';
    return {
      results: contacts.map((c) => ({
        contactId: c.id,
        contactName: c.name,
        phoneNumber: c.number,
        status: 'failed',
        errorMessage: err,
      })),
      allSucceeded: false,
      anySucceeded: false,
      summaryError: err,
    };
  }

  if (!capability.permissionGranted) {
    const granted = await requestSmsPermission();
    if (!granted) {
      const permErr = 'SEND_SMS permission was denied by user. Emergency SMS could not be sent.';
      return {
        results: contacts.map((c) => ({
          contactId: c.id,
          contactName: c.name,
          phoneNumber: c.number,
          status: 'failed',
          errorMessage: permErr,
        })),
        allSucceeded: false,
        anySucceeded: false,
        summaryError: permErr,
      };
    }
  }

  if (capability.simState === 'ABSENT') {
    const noSimErr = 'No active SIM card detected in phone. Cannot send cellular SMS.';
    return {
      results: contacts.map((c) => ({
        contactId: c.id,
        contactName: c.name,
        phoneNumber: c.number,
        status: 'failed',
        errorMessage: noSimErr,
      })),
      allSucceeded: false,
      anySucceeded: false,
      summaryError: noSimErr,
    };
  }

  // 2. Dispatch to all contacts sequentially to prevent radio congestion
  const dispatchResults: RecipientDispatchStatus[] = [];

  for (const contact of contacts) {
    const sendRes = await sendDirectSmsToContact(contact, message, alertId);
    dispatchResults.push({
      contactId: contact.id,
      contactName: contact.name,
      phoneNumber: contact.number,
      status: sendRes.status === 'sent' ? 'sent' : 'failed',
      errorMessage: sendRes.error,
    });
  }

  const allSucceeded = dispatchResults.every((r) => r.status === 'sent');
  const anySucceeded = dispatchResults.some((r) => r.status === 'sent');
  const firstError = dispatchResults.find((r) => r.errorMessage)?.errorMessage;

  return {
    results: dispatchResults,
    allSucceeded,
    anySucceeded,
    summaryError: !anySucceeded ? firstError : undefined,
  };
}

/**
 * Subscribes to native carrier delivery callbacks for an active alert session.
 */
export function subscribeToSmsDeliveryReports(
  onDelivered: (recipientId: string, phoneNumber: string) => void,
  onFailed: (recipientId: string, phoneNumber: string, error: string) => void
): () => void {
  if (!smsEventEmitter) {
    return () => {};
  }

  const deliveredSub = smsEventEmitter.addListener('onSmsDelivered', (event: any) => {
    if (event?.recipientId) {
      onDelivered(event.recipientId, event.phoneNumber);
    }
  });

  const failedSub = smsEventEmitter.addListener('onSmsFailed', (event: any) => {
    if (event?.recipientId) {
      onFailed(
        event.recipientId,
        event.phoneNumber,
        event.errorMessage || 'Carrier delivery failed'
      );
    }
  });

  return () => {
    deliveredSub.remove();
    failedSub.remove();
  };
}
