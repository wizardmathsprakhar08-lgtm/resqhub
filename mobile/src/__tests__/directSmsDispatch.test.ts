import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  checkSmsCapability,
  checkSmsPermission,
  requestSmsPermission,
  sendDirectSmsToContact,
  sendEmergencySmsViaSim,
  subscribeToSmsDeliveryReports,
  isRunningInExpoGo,
} from '../features/sms/directSmsService';
import { dispatchSosAlert } from '../features/alerts/alertService';
import { EmergencyContact, LocationData } from '../types';
import { NativeModules, PermissionsAndroid } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Mock SQLite db module
jest.mock('../database/db', () => ({
  saveAlertHistory: jest.fn(),
  updateAlertStatus: jest.fn(),
  getDbSetting: jest.fn((key: string, def: string) => {
    if (key === 'sms_delivery_method') return 'sim';
    return def;
  }),
  setDbSetting: jest.fn(),
}));

describe('Direct Android SIM SMS & Telephony Integration (Phases 2 & 3)', () => {
  const originalFetch = global.fetch;

  const sampleContacts: EmergencyContact[] = [
    { id: 'c1', name: 'Alice Smith', number: '+919876543210' },
    { id: 'c2', name: 'Bob Jones', number: '+919876543211' },
  ];

  const sampleLocation: LocationData = {
    latitude: 19.076,
    longitude: 72.8777,
    accuracy: 10,
    timestamp: Date.now(),
    mapUrl: 'https://maps.google.com/?q=19.076000,72.877700',
    isCached: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Constants.executionEnvironment = ExecutionEnvironment.Bare;
    (Constants as any).appOwnership = null;
    (PermissionsAndroid.check as any).mockImplementation(() => Promise.resolve(true));
    (PermissionsAndroid.request as any).mockImplementation(() => Promise.resolve('granted'));

    (NativeModules.DirectSms.checkSmsCapability as any).mockImplementation(() =>
      Promise.resolve({
        hasTelephony: true,
        simState: 'READY',
        permissionGranted: true,
        isReady: true,
        isDualSim: false,
        activeSimCount: 1,
        carrierNames: ['Airtel 4G'],
      })
    );

    (NativeModules.DirectSms.sendDirectSms as any).mockImplementation(
      (phoneNumber: string, messageText: string, alertId: string, recipientId: string) =>
        Promise.resolve({
          submitted: true,
          status: 'submitting',
          partsCount: 1,
          alertId,
          recipientId,
          phoneNumber,
        })
    );
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  it('checks SIM and telephony capability correctly when SIM is ready and permission is granted', async () => {
    const capability = await checkSmsCapability();

    expect(capability.supported).toBe(true);
    expect(capability.hasTelephony).toBe(true);
    expect(capability.simState).toBe('READY');
    expect(capability.permissionGranted).toBe(true);
    expect(capability.isReady).toBe(true);
    expect(capability.carrierNames).toContain('Airtel 4G');
  });

  it('detects when no SIM card is present in the device and returns descriptive error', async () => {
    (NativeModules.DirectSms.checkSmsCapability as any).mockImplementation(() =>
      Promise.resolve({
        hasTelephony: true,
        simState: 'ABSENT',
        permissionGranted: true,
        isReady: false,
        activeSimCount: 0,
        error: 'No active SIM card detected in device.',
      })
    );

    const capability = await checkSmsCapability();
    expect(capability.isReady).toBe(false);
    expect(capability.simState).toBe('ABSENT');

    const result = await sendEmergencySmsViaSim(
      sampleContacts,
      'Emergency test',
      'alert_1'
    );
    expect(result.allSucceeded).toBe(false);
    expect(result.anySucceeded).toBe(false);
    expect(result.summaryError).toContain('No active SIM card detected');
    expect(result.results.every((r) => r.status === 'failed')).toBe(true);
  });

  it('handles permission denial without false success and prompts user with rationale', async () => {
    (PermissionsAndroid.check as any).mockImplementation(() => Promise.resolve(false));
    (PermissionsAndroid.request as any).mockImplementation(() => Promise.resolve('denied'));

    (NativeModules.DirectSms.checkSmsCapability as any).mockImplementation(() =>
      Promise.resolve({
        hasTelephony: true,
        simState: 'READY',
        permissionGranted: false,
        isReady: false,
      })
    );

    const hasPermission = await checkSmsPermission();
    expect(hasPermission).toBe(false);

    const granted = await requestSmsPermission();
    expect(granted).toBe(false);
    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      expect.objectContaining({
        title: 'Emergency SMS Permission',
      })
    );

    const result = await sendEmergencySmsViaSim(
      sampleContacts,
      'Emergency message',
      'alert_no_perm'
    );
    expect(result.allSucceeded).toBe(false);
    expect(result.anySucceeded).toBe(false);
    expect(result.summaryError).toContain('SEND_SMS permission was denied');
  });

  it('submits SMS to all contacts sequentially and tracks per-recipient status', async () => {
    const result = await sendEmergencySmsViaSim(
      sampleContacts,
      'RESQHUB SOS ALERT - Need help at Bandra Promenade',
      'alert_success_1'
    );

    expect(result.allSucceeded).toBe(true);
    expect(result.anySucceeded).toBe(true);
    expect(result.results.length).toBe(2);
    expect(result.results[0].status).toBe('sent');
    expect(result.results[1].status).toBe('sent');
    expect(NativeModules.DirectSms.sendDirectSms).toHaveBeenCalledTimes(2);
  });

  it('accurately identifies partial failure when one contact submission fails', async () => {
    (NativeModules.DirectSms.sendDirectSms as any).mockImplementation(
      (phone: string, msg: string, alertId: string, recId: string) => {
        if (phone.endsWith('11')) {
          return Promise.reject(new Error('Cellular radio powered off (Airplane mode)'));
        }
        return Promise.resolve({ submitted: true, status: 'submitting' });
      }
    );

    const result = await sendEmergencySmsViaSim(
      sampleContacts,
      'Emergency test',
      'alert_partial'
    );

    expect(result.allSucceeded).toBe(false);
    expect(result.anySucceeded).toBe(true);
    expect(result.results.find((r) => r.phoneNumber.endsWith('10'))?.status).toBe('sent');
    expect(result.results.find((r) => r.phoneNumber.endsWith('11'))?.status).toBe('failed');
    expect(result.results.find((r) => r.phoneNumber.endsWith('11'))?.errorMessage).toContain(
      'Airplane mode'
    );
  });

  it('detects Expo Go runtime and informs user that native SIM SMS requires development build', async () => {
    Constants.executionEnvironment = ExecutionEnvironment.StoreClient;
    (Constants as any).appOwnership = 'expo';

    expect(isRunningInExpoGo()).toBe(true);

    const capability = await checkSmsCapability();
    expect(capability.supported).toBe(false);
    expect(capability.isExpoGo).toBe(true);
    expect(capability.error).toContain('development build');

    const result = await sendEmergencySmsViaSim(
      sampleContacts,
      'Expo Go test',
      'alert_expogo'
    );
    expect(result.allSucceeded).toBe(false);
    expect(result.summaryError).toContain('development build');
  });

  it('integrates with dispatchSosAlert to persist alert with channel: sim to backend without duplicate sends', async () => {
    let capturedBody: any = null;
    (global as any).fetch = jest.fn((url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: 'backend_persisted_sim_alert_123',
            status: 'sent',
            recipients: capturedBody.recipients,
          }),
      });
    });

    const dispatchResult = await dispatchSosAlert(
      sampleContacts,
      sampleLocation,
      'Emergency assistance needed!'
    );

    expect(dispatchResult.success).toBe(true);
    expect(dispatchResult.status).toBe('sent');
    expect(dispatchResult.alertId).toBe('backend_persisted_sim_alert_123');
    expect(capturedBody).toBeDefined();
    expect(capturedBody.channel).toBe('sim');
    expect(capturedBody.recipients.length).toBe(2);
    expect(capturedBody.recipients[0].delivery_status).toBe('sent');
  });

  it('subscribes to carrier delivery report events', () => {
    const onDelivered = jest.fn();
    const onFailed = jest.fn();

    const unsubscribe = subscribeToSmsDeliveryReports(onDelivered, onFailed);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});
