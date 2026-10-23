import { describe, it, expect } from '@jest/globals';
import {
  normalizeBackendUrl,
  validateBackendUrl,
  DEFAULT_BACKEND_URL,
} from '../features/settings/urlUtils';
import { formatEmergencyLocationMessage } from '../features/location/messageFormatter';
import {
  SOS_HOLD_DURATION_MS,
  SOS_COUNTDOWN_SECONDS,
  LOCATION_TIMEOUT_MS,
  BACKEND_REQUEST_TIMEOUT_MS,
} from '../constants/timing';
import { LocationData } from '../types';

describe('SOS Timing Constants & Single Source of Truth', () => {
  it('enforces exact 500ms press-and-hold duration', () => {
    expect(SOS_HOLD_DURATION_MS).toBe(500);
  });

  it('enforces exact 3-second cancelable countdown', () => {
    expect(SOS_COUNTDOWN_SECONDS).toBe(3);
  });

  it('enforces bounded timeouts for GPS and backend request', () => {
    expect(LOCATION_TIMEOUT_MS).toBe(8000);
    expect(BACKEND_REQUEST_TIMEOUT_MS).toBe(15000);
  });
});

describe('Backend URL Normalization & Validation', () => {
  it('normalizes valid URL and preserves /api/v1 path', () => {
    const url = 'http://192.168.1.100:8000/api/v1';
    expect(normalizeBackendUrl(url)).toBe('http://192.168.1.100:8000/api/v1');
  });

  it('automatically appends /api/v1 if omitted', () => {
    expect(normalizeBackendUrl('http://192.168.1.100:8000')).toBe('http://192.168.1.100:8000/api/v1');
    expect(normalizeBackendUrl('http://192.168.1.100:8000/')).toBe('http://192.168.1.100:8000/api/v1');
    expect(normalizeBackendUrl('http://192.168.1.100:8000/api')).toBe('http://192.168.1.100:8000/api/v1');
  });

  it('strips redundant trailing slashes', () => {
    expect(normalizeBackendUrl('http://10.0.2.2:8000/api/v1///')).toBe('http://10.0.2.2:8000/api/v1');
  });

  it('prepends http:// if scheme is missing', () => {
    expect(normalizeBackendUrl('192.168.1.50:8000')).toBe('http://192.168.1.50:8000/api/v1');
  });

  it('validates correct HTTP and HTTPS URLs', () => {
    const res1 = validateBackendUrl('http://10.0.2.2:8000/api/v1');
    expect(res1.isValid).toBe(true);

    const res2 = validateBackendUrl('https://api.resqhub.org/api/v1');
    expect(res2.isValid).toBe(true);
  });

  it('rejects malformed or empty URLs', () => {
    const res = validateBackendUrl('not an ip address');
    expect(res.isValid).toBe(false);
    expect(res.error).toBeDefined();
  });
});

describe('Emergency Location Message Formatting (Phase 7)', () => {
  const customMessage = 'Need urgent assistance, fallen and cannot get up.';

  it('formats full message with real coordinates, map link, and accuracy', () => {
    const realLocation: LocationData = {
      latitude: 19.07609,
      longitude: 72.877426,
      accuracy: 12.4,
      timestamp: Date.now(),
      mapUrl: 'https://maps.google.com/?q=19.076090,72.877426',
      isCached: false,
    };

    const formatted = formatEmergencyLocationMessage(customMessage, realLocation);

    expect(formatted).toContain('RESQHUB SOS ALERT');
    expect(formatted).toContain(customMessage);
    expect(formatted).toContain('19.076090, 72.877426');
    expect(formatted).toContain('https://maps.google.com/?q=19.076090,72.877426');
    expect(formatted).toContain('Accuracy: approximately 12 metres');
    expect(formatted).toContain('Please contact me or arrange assistance.');
    expect(formatted).not.toContain('(Note: Last known location');
  });

  it('clearly marks cached location with recorded timestamp note', () => {
    const pastTime = new Date('2026-10-19T10:30:00Z').getTime();
    const cachedLocation: LocationData = {
      latitude: 18.52043,
      longitude: 73.856744,
      accuracy: 25,
      timestamp: pastTime,
      mapUrl: 'https://maps.google.com/?q=18.520430,73.856744',
      isCached: true,
    };

    const formatted = formatEmergencyLocationMessage(customMessage, cachedLocation);

    expect(formatted).toContain('RESQHUB SOS ALERT');
    expect(formatted).toContain('(Note: Last known location recorded at');
  });

  it('includes reverse geocoded readable address when available in location data', () => {
    const locationWithAddress: LocationData = {
      latitude: 28.6315,
      longitude: 77.2167,
      accuracy: 10,
      timestamp: Date.now(),
      mapUrl: 'https://maps.google.com/?q=28.631500,77.216700',
      readableAddress: {
        area: 'Connaught Place',
        city: 'New Delhi',
        state: 'Delhi',
        postalCode: '110001',
        country: 'India',
        formattedAddress: 'Connaught Place, New Delhi, Delhi - 110001, India',
      },
    };

    const formatted = formatEmergencyLocationMessage(customMessage, locationWithAddress);

    expect(formatted).toContain('RESQHUB SOS ALERT');
    expect(formatted).toContain('28.631500, 77.216700');
    expect(formatted).toContain('Address: Connaught Place, New Delhi, Delhi - 110001, India');
    expect(formatted).toContain('https://maps.google.com/?q=28.631500,77.216700');
  });

  it('handles unavailable GPS gracefully without fake coordinates or map links', () => {
    const formatted = formatEmergencyLocationMessage(customMessage, undefined);

    expect(formatted).toContain('RESQHUB SOS ALERT');
    expect(formatted).toContain(customMessage);
    expect(formatted).toContain('Location: Unavailable (GPS fix could not be acquired)');
    expect(formatted).not.toContain('https://maps.google.com');
  });
});

import {
  reverseGeocodeLocation,
  getCurrentLocationWithTimeout,
} from '../features/location/locationService';

describe('Reverse Geocoding & GPS Location Acquisition', () => {
  it('converts coordinates to readable address structure', async () => {
    const addr = await reverseGeocodeLocation({ latitude: 19.076, longitude: 72.8777 });
    expect(addr).not.toBeNull();
    expect(addr?.city).toBe('Mumbai');
    expect(addr?.state).toBe('Maharashtra');
    expect(addr?.country).toBe('India');
    expect(addr?.formattedAddress).toContain('Bandra');
  });

  it('acquires current location with coordinates and enriched address', async () => {
    const result = await getCurrentLocationWithTimeout({ timeoutMs: 5000 });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.latitude).toBeCloseTo(19.076, 3);
    expect(result.data?.longitude).toBeCloseTo(72.8777, 3);
    expect(result.data?.mapUrl).toContain('maps.google.com');
    expect(result.data?.readableAddress).toBeDefined();
    expect(result.data?.readableAddress?.city).toBe('Mumbai');
  });
});

