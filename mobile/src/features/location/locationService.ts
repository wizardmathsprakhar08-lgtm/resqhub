import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import {
  LocationData,
  LocationResult,
  LocationErrorType,
  ReadableAddress,
} from '../../types';
import { LOCATION_TIMEOUT_MS } from '../../constants/timing';

export { LocationResult, LocationErrorType, ReadableAddress };

/**
 * Checks whether foreground location permission is currently granted.
 */
export async function checkLocationPermission(): Promise<boolean> {
  try {
    const permPromise = Location.getForegroundPermissionsAsync();
    const timeoutPromise = new Promise<{ status: string }>((resolve) =>
      setTimeout(() => resolve({ status: 'undetermined' }), 2000)
    );
    const { status } = await Promise.race([permPromise, timeoutPromise]);
    return status === 'granted';
  } catch (err) {
    console.warn('Failed to check location permission:', err);
    return false;
  }
}

export interface LocationPermissionDetails {
  granted: boolean;
  status: Location.PermissionStatus | 'undetermined';
  canAskAgain: boolean;
}

/**
 * Retrieves detailed location permission status including canAskAgain flag.
 */
export async function getLocationPermissionDetails(): Promise<LocationPermissionDetails> {
  try {
    const permPromise = Location.getForegroundPermissionsAsync();
    const timeoutPromise = new Promise<Location.LocationPermissionResponse>((resolve) =>
      setTimeout(
        () =>
          resolve({
            status: Location.PermissionStatus.UNDETERMINED,
            granted: false,
            canAskAgain: true,
            expires: 'never',
          }),
        2000
      )
    );
    const perm = await Promise.race([permPromise, timeoutPromise]);
    return {
      granted: perm.granted || perm.status === Location.PermissionStatus.GRANTED,
      status: perm.status,
      canAskAgain: perm.canAskAgain ?? true,
    };
  } catch (err) {
    console.warn('Failed to retrieve location permission details:', err);
    return {
      granted: false,
      status: 'undetermined',
      canAskAgain: true,
    };
  }
}

/**
 * Requests foreground location permission from the device.
 */
export async function requestLocationPermission(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  try {
    const reqPromise = Location.requestForegroundPermissionsAsync();
    const timeoutPromise = new Promise<{ status: string; canAskAgain?: boolean }>((resolve) =>
      setTimeout(() => resolve({ status: 'denied', canAskAgain: true }), 10000)
    );
    const { status, canAskAgain } = await Promise.race([reqPromise, timeoutPromise]);
    return {
      granted: status === 'granted',
      canAskAgain: canAskAgain ?? true,
    };
  } catch (err) {
    console.error('Failed to request location permission:', err);
    return { granted: false, canAskAgain: false };
  }
}

/**
 * Checks whether hardware/system location services (GPS) are turned on.
 */
export async function isLocationServicesEnabled(): Promise<boolean> {
  try {
    const servicesPromise = Location.hasServicesEnabledAsync();
    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(true), 2000)
    );
    return await Promise.race([servicesPromise, timeoutPromise]);
  } catch (err) {
    console.warn('Unable to verify location services status:', err);
    return true; // Default to optimistic true if check unsupported
  }
}

/**
 * Opens the device application settings screen so the user can grant permission.
 */
export async function openDeviceSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (err) {
    console.error('Failed to open app settings:', err);
  }
}

/**
 * Converts geographic coordinates into readable address details (Area, City, State, PIN, Country).
 * Guaranteed to return within 2.5 seconds or fall back cleanly. Never blocks the SOS flow.
 */
export async function reverseGeocodeLocation(coords: {
  latitude: number;
  longitude: number;
}): Promise<ReadableAddress | null> {
  try {
    const geocodePromise = Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 2500)
    );

    const addresses = await Promise.race([geocodePromise, timeoutPromise]);
    if (!addresses || addresses.length === 0) return null;

    const addr = addresses[0];

    // Deduplicate and assemble locality/area parts
    const areaParts = [addr.name, addr.street, addr.subregion]
      .filter((val): val is string => Boolean(val && val.trim()))
      .filter((val, idx, arr) => arr.indexOf(val) === idx);
    const area = areaParts.length > 0 ? areaParts.join(', ') : undefined;

    const city = addr.city || addr.district || undefined;
    const state = addr.region || undefined;
    const postalCode = addr.postalCode || undefined;
    const country = addr.country || undefined;

    // Assembled human-readable single-line string
    const summaryParts = [
      area,
      city,
      state ? `${state}${postalCode ? ` - ${postalCode}` : ''}` : postalCode,
      country,
    ].filter(Boolean);

    const formattedAddress =
      addr.formattedAddress || (summaryParts.length > 0 ? summaryParts.join(', ') : undefined);

    return {
      area,
      city,
      state,
      postalCode,
      country,
      formattedAddress,
    };
  } catch (err) {
    console.warn('Reverse geocoding encountered an issue:', err);
    return null;
  }
}

/**
 * Obtains current position with a bounded timeout and graceful last-known fallback.
 * Uses Location.Accuracy.Balanced for rapid fix indoors and outdoors.
 * Enriches coordinates with readable address if available within deadline.
 */
export async function getCurrentLocationWithTimeout(
  options: {
    timeoutMs?: number;
    allowCachedFallback?: boolean;
    accuracy?: Location.LocationAccuracy;
    includeAddress?: boolean;
  } = {}
): Promise<LocationResult> {
  const timeoutMs = options.timeoutMs ?? LOCATION_TIMEOUT_MS;
  const allowCached = options.allowCachedFallback ?? true;
  const accuracy = options.accuracy ?? Location.Accuracy.Balanced;
  const includeAddress = options.includeAddress ?? true;

  // Enforce overall hard ceiling so this function NEVER hangs indefinitely
  const overallDeadlinePromise = new Promise<LocationResult>((resolve) => {
    setTimeout(() => {
      resolve({
        success: false,
        errorType: 'timeout',
        error: `GPS acquisition timed out after ${Math.round(timeoutMs / 1000)}s. Satellite signal may be obscured indoors.`,
      });
    }, timeoutMs + 500);
  });

  const executionPromise = (async (): Promise<LocationResult> => {
    // 1. Verify Permission
    const hasPermission = await checkLocationPermission();
    console.log(`[ResQHub Location] Foreground permission check: ${hasPermission ? 'granted' : 'not granted'}`);
    if (!hasPermission) {
      console.log('[ResQHub Location] Requesting foreground location permission...');
      const req = await requestLocationPermission();
      console.log(`[ResQHub Location] Permission request result: granted=${req.granted}, canAskAgain=${req.canAskAgain}`);
      if (!req.granted) {
        return {
          success: false,
          permissionDenied: true,
          errorType: 'permission_denied',
          error: 'Location permission was denied. Please allow location access in device Settings.',
        };
      }
    }

    // 2. Verify GPS Hardware / Provider is enabled
    const servicesEnabled = await isLocationServicesEnabled();
    console.log(`[ResQHub Location] Hardware location services enabled: ${servicesEnabled}`);
    if (!servicesEnabled) {
      return {
        success: false,
        errorType: 'gps_disabled',
        error: 'Device Location/GPS is disabled. Please turn on Location in Quick Settings.',
      };
    }

    console.log(`[ResQHub Location] Starting position acquisition (timeout=${timeoutMs}ms, cachedFallback=${allowCached})...`);

    // 3. Pre-fetch last-known cached position in parallel as an immediate safety net
    const cachedPositionPromise = (async (): Promise<LocationData | null> => {
      if (!allowCached) return null;
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown && lastKnown.coords) {
          const mapUrl = `https://maps.google.com/?q=${lastKnown.coords.latitude.toFixed(6)},${lastKnown.coords.longitude.toFixed(6)}`;
          return {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            accuracy: lastKnown.coords.accuracy ?? null,
            timestamp: lastKnown.timestamp,
            mapUrl,
            isCached: true,
          };
        }
      } catch (err) {
        console.warn('[ResQHub Location] Error retrieving cached position:', err);
      }
      return null;
    })();

    // 4. Attempt fresh satellite/network position retrieval
    const freshPositionPromise = (async (): Promise<LocationData | null> => {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy,
          mayShowUserSettingsDialog: true,
        });

        if (!loc || !loc.coords) return null;

        const mapUrl = `https://maps.google.com/?q=${loc.coords.latitude.toFixed(6)},${loc.coords.longitude.toFixed(6)}`;
        return {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? null,
          timestamp: loc.timestamp,
          mapUrl,
          isCached: false,
        };
      } catch (err) {
        console.warn('[ResQHub Location] Fresh GPS acquisition unfulfilled:', err);
        return null;
      }
    })();

    const freshTimeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), Math.max(3000, timeoutMs - 1500));
    });

    let position = await Promise.race([freshPositionPromise, freshTimeoutPromise]);

    // 5. If fresh fix timed out or unavailable, immediately use pre-fetched cached fallback
    if (!position && allowCached) {
      position = await cachedPositionPromise;
      if (position) {
        const ageSec = Math.round((Date.now() - position.timestamp) / 1000);
        console.log(`[ResQHub Location] Fresh GPS timed out; fell back to cached location (age: ${ageSec}s, accuracy: ±${Math.round(position.accuracy ?? 0)}m)`);
      }
    }

    if (position) {
      console.log(`[ResQHub Location] Position acquired (cached=${!!position.isCached}): ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}, accuracy=±${Math.round(position.accuracy ?? 0)}m`);

      // 5. Optionally reverse geocode coordinates within a brief bounded window
      if (includeAddress) {
        try {
          console.log('[ResQHub Location] Reverse-geocoding coordinates...');
          const address = await reverseGeocodeLocation({
            latitude: position.latitude,
            longitude: position.longitude,
          });
          if (address) {
            position.readableAddress = address;
            console.log(`[ResQHub Location] Reverse-geocoded address: ${address.formattedAddress || address.area || address.city || 'unresolved'}`);
          }
        } catch {
          // Reverse geocoding failure is non-fatal
        }
      }

      return {
        success: true,
        data: position,
      };
    }

    console.warn('[ResQHub Location] Position acquisition failed: GPS timed out indoors or signal obscured');
    return {
      success: false,
      errorType: 'timeout',
      error: `GPS acquisition timed out after ${Math.round(timeoutMs / 1000)}s. Satellite signal may be obscured indoors.`,
    };
  })();

  return await Promise.race([executionPromise, overallDeadlinePromise]);
}

import { formatEmergencyLocationMessage } from './messageFormatter';

export { formatEmergencyLocationMessage };

