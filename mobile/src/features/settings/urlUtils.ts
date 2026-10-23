/**
 * URL and Host utilities for ResQHub backend configuration.
 */

export const DEFAULT_BACKEND_URL = 'http://10.0.2.2:8000/api/v1';
export const DEFAULT_PRIMARY_EMERGENCY_NUMBER = '112';
export const DEFAULT_MESSAGE = 'I am in DANGER, i need help. Please urgently reach me out.';

export function normalizeBackendUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if (!url) return DEFAULT_BACKEND_URL;

  // Add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }

  // Remove trailing slashes
  url = url.replace(/\/+$/, '');

  // Ensure /api/v1 path suffix exists
  if (!/\/api\/v1$/i.test(url)) {
    if (/\/api$/i.test(url)) {
      url = `${url}/v1`;
    } else {
      url = `${url}/api/v1`;
    }
  }

  return url;
}

export function validateBackendUrl(rawUrl: string): { isValid: boolean; error?: string; normalizedUrl: string } {
  const normalized = normalizeBackendUrl(rawUrl);

  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { isValid: false, error: 'URL must use http:// or https://', normalizedUrl: normalized };
    }
    if (!parsed.hostname) {
      return { isValid: false, error: 'URL is missing a valid host name or IP address', normalizedUrl: normalized };
    }
    return { isValid: true, normalizedUrl: normalized };
  } catch {
    return { isValid: false, error: 'Invalid URL format. Example: http://192.168.1.50:8000/api/v1', normalizedUrl: normalized };
  }
}
