import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getDbSetting, setDbSetting } from '../../database/db';
import { AppSettings } from '../../types';
import {
  DEFAULT_BACKEND_URL,
  DEFAULT_PRIMARY_EMERGENCY_NUMBER,
  DEFAULT_MESSAGE,
  normalizeBackendUrl,
  validateBackendUrl,
} from './urlUtils';

export {
  DEFAULT_BACKEND_URL,
  DEFAULT_PRIMARY_EMERGENCY_NUMBER,
  DEFAULT_MESSAGE,
  normalizeBackendUrl,
  validateBackendUrl,
};

const SECURE_KEY_DEVICE_ID = 'resqhub_device_id';
const SECURE_KEY_API_KEY = 'resqhub_api_key';

export async function getDeviceId(): Promise<string> {
  try {
    let id = await SecureStore.getItemAsync(SECURE_KEY_DEVICE_ID);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      await SecureStore.setItemAsync(SECURE_KEY_DEVICE_ID, id);
    }
    return id;
  } catch {
    return 'dev_fallback_' + Date.now();
  }
}

export async function getApiKey(): Promise<string> {
  try {
    let key = await SecureStore.getItemAsync(SECURE_KEY_API_KEY);
    if (!key) {
      key = 'resqhub-development-api-key';
      await SecureStore.setItemAsync(SECURE_KEY_API_KEY, key);
    }
    return key;
  } catch {
    return 'resqhub-development-api-key';
  }
}

export async function testBackendConnection(targetUrl?: string): Promise<{
  success: boolean;
  latencyMs?: number;
  error?: string;
  statusText?: string;
}> {
  const urlToTest = targetUrl ? normalizeBackendUrl(targetUrl) : loadAppSettings().backendUrl;
  const healthEndpoint = `${urlToTest}/health`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout for testing

    const response = await fetch(healthEndpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        success: true,
        latencyMs,
        statusText: data.status === 'healthy' ? 'Server is operational & healthy' : 'Server reached (degraded)',
      };
    } else {
      return {
        success: false,
        latencyMs,
        error: `Server responded with HTTP ${response.status} (${response.statusText})`,
      };
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('cancelled')) {
      return {
        success: false,
        latencyMs,
        error: 'Connection timed out after 6 seconds. Check if host IP and port are reachable.',
      };
    }
    return {
      success: false,
      latencyMs,
      error: err.message || 'Network unreachable. Check your Wi-Fi/LAN connection.',
    };
  }
}

export function loadAppSettings(): AppSettings {
  const customMessage = getDbSetting('custom_message', DEFAULT_MESSAGE);
  const shakeEnabled = getDbSetting('shake_enabled', 'false') === 'true';
  const shakeSensitivity = (getDbSetting('shake_sensitivity', 'medium') as 'low' | 'medium' | 'high');
  const backendUrl = normalizeBackendUrl(getDbSetting('backend_url', DEFAULT_BACKEND_URL));
  const onboardingCompleted = getDbSetting('onboarding_completed', 'false') === 'true';
  const primaryEmergencyNumber = getDbSetting('primary_emergency_number', DEFAULT_PRIMARY_EMERGENCY_NUMBER);
  const smsDeliveryMethod = (getDbSetting('sms_delivery_method', 'sim') as 'sim' | 'backend');

  return {
    customMessage,
    shakeEnabled,
    shakeSensitivity,
    backendUrl,
    deviceId: '',
    onboardingCompleted,
    primaryEmergencyNumber,
    smsDeliveryMethod,
  };
}

export function saveSmsDeliveryMethod(method: 'sim' | 'backend'): void {
  setDbSetting('sms_delivery_method', method);
}

export function saveCustomMessage(msg: string): void {
  setDbSetting('custom_message', msg.trim() || DEFAULT_MESSAGE);
}

export function resetCustomMessage(): string {
  setDbSetting('custom_message', DEFAULT_MESSAGE);
  return DEFAULT_MESSAGE;
}

export function saveShakeSettings(enabled: boolean, sensitivity: 'low' | 'medium' | 'high'): void {
  setDbSetting('shake_enabled', enabled ? 'true' : 'false');
  setDbSetting('shake_sensitivity', sensitivity);
}

export function saveBackendUrl(url: string): { success: boolean; normalizedUrl: string; error?: string } {
  const validation = validateBackendUrl(url);
  if (!validation.isValid) {
    return { success: false, normalizedUrl: validation.normalizedUrl, error: validation.error };
  }
  setDbSetting('backend_url', validation.normalizedUrl);
  return { success: true, normalizedUrl: validation.normalizedUrl };
}

export function savePrimaryEmergencyNumber(num: string): void {
  const clean = num.trim() || DEFAULT_PRIMARY_EMERGENCY_NUMBER;
  setDbSetting('primary_emergency_number', clean);
}

export function setOnboardingCompleted(completed: boolean): void {
  setDbSetting('onboarding_completed', completed ? 'true' : 'false');
}
