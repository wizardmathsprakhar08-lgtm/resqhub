import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { dispatchSosAlert, fetchSmsDiagnostics } from '../features/alerts/alertService';
import { EmergencyContact, LocationData } from '../types';

// Mock sqlite db module to avoid native SQLite dependency in node test runner
jest.mock('../database/db', () => ({
  saveAlertHistory: jest.fn(),
  updateAlertStatus: jest.fn(),
  getDbSetting: jest.fn((key: string, def: string) => {
    if (key === 'sms_delivery_method') return 'backend';
    return def;
  }),
  setDbSetting: jest.fn(),
}));

describe('SOS Dispatch & Network Reliability (Phases 3 & 5)', () => {
  const originalFetch = global.fetch;

  const sampleContacts: EmergencyContact[] = [
    { id: 'c1', name: 'Alice Smith', number: '+919876543210' },
    { id: 'c2', name: 'Bob Jones', number: '+919876543211' },
  ];

  const sampleLocation: LocationData = {
    latitude: 19.0760,
    longitude: 72.8777,
    accuracy: 15,
    timestamp: Date.now(),
    mapUrl: 'https://maps.google.com/?q=19.076000,72.877700',
    isCached: false,
  };

  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('successfully dispatches SOS when backend responds 201 Created', async () => {
    (global as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: 'alert_uuid_123',
            status: 'sent',
            recipients: [
              { id: 'c1', contact_name: 'Alice Smith', phone_number: '+919876543210', delivery_status: 'sent' },
              { id: 'c2', contact_name: 'Bob Jones', phone_number: '+919876543211', delivery_status: 'sent' },
            ],
          }),
      })
    );

    const result = await dispatchSosAlert(sampleContacts, sampleLocation, 'Emergency assistance needed!');

    expect(result.success).toBe(true);
    expect(result.alertId).toBe('alert_uuid_123');
    expect(result.status).toBe('sent');
    expect(result.recipients.length).toBe(2);
    expect(result.recipients[0].status).toBe('sent');
  });

  it('accurately identifies partial failure when some recipients fail', async () => {
    (global as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: 'alert_uuid_partial',
            status: 'partial_failure',
            recipients: [
              { id: 'c1', contact_name: 'Alice Smith', phone_number: '+919876543210', delivery_status: 'sent' },
              { id: 'c2', contact_name: 'Bob Jones', phone_number: '+919876543211', delivery_status: 'failed', error_message: 'Twilio unreachable' },
            ],
          }),
      })
    );

    const result = await dispatchSosAlert(sampleContacts, sampleLocation);

    expect(result.success).toBe(true);
    expect(result.status).toBe('partial_failure');
    expect(result.recipients.find((r) => r.contactName === 'Bob Jones')?.status).toBe('failed');
  });

  it('accurately identifies complete provider delivery failure without false success', async () => {
    (global as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: 'alert_uuid_all_failed',
            status: 'failed',
            recipients: [
              {
                id: 'c1',
                contact_name: 'Alice Smith',
                phone_number: '+919876543210',
                delivery_status: 'failed',
                error_message: 'Twilio Error 572002: Destination number is not verified',
              },
              {
                id: 'c2',
                contact_name: 'Bob Jones',
                phone_number: '+919876543211',
                delivery_status: 'failed',
                error_message: 'Twilio Error 572006: Trial account restriction',
              },
            ],
          }),
      })
    );

    const result = await dispatchSosAlert(sampleContacts, sampleLocation);

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.errorCategory).toBe('provider_failure');
    expect(result.error).toContain('Twilio Error');
    expect(result.recipients.every((r) => r.status === 'failed')).toBe(true);
  });

  it('categorizes network unreachable failures without false success', async () => {
    (global as any).fetch = jest.fn(() =>
      Promise.reject(new Error('Network request failed'))
    );

    const result = await dispatchSosAlert(sampleContacts, sampleLocation);

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.errorCategory).toBe('network_failure');
    expect(result.isOfflineFallback).toBe(true);
    expect(result.recipients.every((r) => r.status === 'failed')).toBe(true);
  });

  it('categorizes aborted / cancelled requests as timeout', async () => {
    const abortErr = new Error('fetch request has been cancelled');
    abortErr.name = 'AbortError';

    (global as any).fetch = jest.fn(() => Promise.reject(abortErr));

    const result = await dispatchSosAlert(sampleContacts, sampleLocation);

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.errorCategory).toBe('timeout');
    expect(result.error).toContain('timed out');
  });

  it('categorizes 401 response as auth_failure', async () => {
    (global as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ detail: 'Invalid or missing X-API-Key header' }),
      })
    );

    const result = await dispatchSosAlert(sampleContacts, sampleLocation);

    expect(result.success).toBe(false);
    expect(result.errorCategory).toBe('auth_failure');
  });

  it('truthfully maps mock SMS mode as mock status without masquerading as sent or delivered', async () => {
    (global as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: 'alert_uuid_mock_test',
            status: 'mock',
            recipients: [
              { id: 'c1', contact_name: 'Alice Smith', phone_number: '+919876543210', delivery_status: 'mock' },
              { id: 'c2', contact_name: 'Bob Jones', phone_number: '+919876543211', delivery_status: 'mock' },
            ],
          }),
      })
    );

    const result = await dispatchSosAlert(sampleContacts, sampleLocation);

    expect(result.success).toBe(true);
    expect(result.status).toBe('mock');
    expect(result.recipients[0].status).toBe('mock');
    expect(result.recipients[1].status).toBe('mock');
    expect(result.recipients[0].status).not.toBe('delivered');
  });

  it('fetches server SMS diagnostics safely without credentials', async () => {
    (global as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            mock_mode: true,
            twilio_installed: true,
            account_sid_configured: false,
            auth_token_configured: false,
            from_number_configured: false,
            masked_from_number: null,
            configuration_status: 'mock_mode',
            guidance: 'MOCK_SMS_PROVIDER is enabled.',
            last_dispatch: null,
          }),
      })
    );

    const result = await fetchSmsDiagnostics();

    expect(result.success).toBe(true);
    expect(result.mockMode).toBe(true);
    expect(result.configurationStatus).toBe('mock_mode');
    expect(result.guidance).toContain('MOCK_SMS_PROVIDER');
  });
});
