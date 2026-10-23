import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { Card } from './Card';
import { Button } from './Button';
import { LocationData, LocationResult, LocationErrorType } from '../types';
import {
  checkLocationPermission,
  requestLocationPermission,
  getLocationPermissionDetails,
  isLocationServicesEnabled,
  openDeviceSettings,
  getCurrentLocationWithTimeout,
} from '../features/location/locationService';

export const CurrentLocationCard: React.FC = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [canAskAgain, setCanAskAgain] = useState<boolean>(true);
  const [servicesEnabled, setServicesEnabled] = useState<boolean>(true);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<LocationErrorType | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchLocation = useCallback(async (isRefresh = false) => {
    if (!isMountedRef.current) return;
    setIsLoading(true);
    setError(null);
    setErrorType(null);

    // 1. Check services enabled
    const enabled = await isLocationServicesEnabled();
    if (!isMountedRef.current) return;
    setServicesEnabled(enabled);
    if (!enabled) {
      setIsLoading(false);
      setError('Device Location / GPS is turned off.');
      setErrorType('gps_disabled');
      return;
    }

    // 2. Fetch position
    const res: LocationResult = await getCurrentLocationWithTimeout({
      timeoutMs: 8000,
      allowCachedFallback: true,
    });

    if (!isMountedRef.current) return;
    setIsLoading(false);

    if (res.success && res.data) {
      setLocation(res.data);
      setHasPermission(true);
      setError(null);
    } else {
      setError(res.error || 'Unable to determine GPS coordinates.');
      setErrorType(res.errorType || 'unknown');
      if (res.permissionDenied) {
        setHasPermission(false);
      }
    }
  }, []);

  const initPermissionsAndLocation = useCallback(async () => {
    const details = await getLocationPermissionDetails();
    if (!isMountedRef.current) return;
    setHasPermission(details.granted);
    setCanAskAgain(details.canAskAgain);

    if (details.granted) {
      fetchLocation(false);
    }
  }, [fetchLocation]);

  useEffect(() => {
    isMountedRef.current = true;
    initPermissionsAndLocation();
    return () => {
      isMountedRef.current = false;
    };
  }, [initPermissionsAndLocation]);

  const handleRequestPermission = async () => {
    setIsLoading(true);
    setError(null);
    const req = await requestLocationPermission();
    if (!isMountedRef.current) return;
    setHasPermission(req.granted);
    setCanAskAgain(req.canAskAgain);
    setIsLoading(false);

    if (req.granted) {
      fetchLocation(false);
    } else {
      setError('Location permission was denied. Please allow location in settings.');
      setErrorType('permission_denied');
    }
  };

  // State A: Permission Not Yet Granted (Education / Rationale)
  if (hasPermission === false && canAskAgain) {
    return (
      <Card style={styles.card} variant="elevated">
        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="location-outline" size={20} color={colors.emergency} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyBold, styles.title]}>Foreground Location Access</Text>
            <Text style={[typography.caption, styles.subtitle]}>Essential for rapid emergency dispatch</Text>
          </View>
        </View>

        <Text style={[typography.caption, styles.rationaleText]}>
          ResQHub uses your coordinates strictly during an emergency SOS or when you refresh your location. Your coordinates and Google Maps link are sent to your trusted contacts so they can locate you immediately.
        </Text>

        <Button
          title={isLoading ? 'Requesting...' : 'Grant Location Permission'}
          variant="outline"
          size="small"
          loading={isLoading}
          onPress={handleRequestPermission}
          style={{ marginTop: spacing.sm }}
        />
      </Card>
    );
  }

  // State B: Permission Denied permanently (Link to Device Settings)
  if (hasPermission === false && !canAskAgain) {
    return (
      <Card style={[styles.card, { borderColor: colors.emergencyLight }]} variant="outlined">
        <View style={styles.headerRow}>
          <Ionicons name="alert-circle" size={22} color={colors.emergencyDark} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[typography.bodyBold, { color: colors.emergencyDark }]}>Location Permission Denied</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              ResQHub cannot attach GPS coordinates to emergency alerts without permission.
            </Text>
          </View>
        </View>

        <Button
          title="Open Device Settings"
          variant="accent"
          size="small"
          onPress={openDeviceSettings}
          style={{ marginTop: spacing.sm }}
        />
      </Card>
    );
  }

  // State C: Location services (GPS) turned off on device
  if (errorType === 'gps_disabled') {
    return (
      <Card style={[styles.card, { borderColor: '#F59E0B' }]} variant="outlined">
        <View style={styles.headerRow}>
          <Ionicons name="warning" size={22} color="#B45309" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[typography.bodyBold, { color: '#B45309' }]}>Device GPS / Location is Off</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Turn on Location in your phone's Quick Settings to enable live SOS positioning.
            </Text>
          </View>
        </View>

        <Button
          title={isLoading ? 'Checking...' : 'Check Again'}
          variant="outline"
          size="small"
          loading={isLoading}
          onPress={() => fetchLocation(true)}
          style={{ marginTop: spacing.sm }}
        />
      </Card>
    );
  }

  return (
    <Card style={styles.card} variant="elevated">
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="navigate" size={18} color={colors.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleLine}>
            <Text style={[typography.bodyBold, styles.title]}>Current Location</Text>
            {location?.isCached ? (
              <View style={styles.cachedTag}>
                <Text style={styles.cachedTagText}>CACHED</Text>
              </View>
            ) : null}
          </View>
          <Text style={[typography.caption, styles.subtitle]}>
            {location
              ? `Updated ${new Date(location.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Acquiring GPS fix...'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetchLocation(true)}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Refresh current GPS location"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.teal} />
          ) : (
            <Ionicons name="refresh" size={18} color={colors.teal} />
          )}
        </TouchableOpacity>
      </View>

      {location ? (
        <View style={styles.locationContent}>
          {location.readableAddress?.area ? (
            <Text style={[typography.bodyBold, styles.areaText]} numberOfLines={2}>
              {location.readableAddress.area}
            </Text>
          ) : null}

          {location.readableAddress?.city || location.readableAddress?.state ? (
            <Text style={[typography.caption, styles.localityText]}>
              {[
                location.readableAddress.city,
                location.readableAddress.state,
                location.readableAddress.postalCode,
                location.readableAddress.country,
              ]
                .filter(Boolean)
                .join(', ')}
            </Text>
          ) : location.readableAddress?.formattedAddress ? (
            <Text style={[typography.caption, styles.localityText]}>
              {location.readableAddress.formattedAddress}
            </Text>
          ) : null}

          <View style={styles.coordsRow}>
            <Ionicons name="compass-outline" size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={[typography.caption, styles.coordsText]}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          </View>

          <View style={styles.metaRow}>
            {location.accuracy != null ? (
              <Text style={[typography.caption, styles.metaItem]}>
                Accuracy: ±{Math.round(location.accuracy)} m
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={() => Linking.openURL(location.mapUrl)}
              style={styles.mapLinkTouch}
              accessibilityRole="link"
              accessibilityLabel="Open coordinates in Google Maps"
            >
              <Text style={styles.mapLink}>Open Map</Text>
              <Ionicons name="open-outline" size={12} color={colors.teal} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[typography.caption, { color: colors.emergency }]}>{error}</Text>
          <Button
            title={isLoading ? 'Retrying...' : 'Retry GPS'}
            variant="ghost"
            size="small"
            loading={isLoading}
            onPress={() => fetchLocation(true)}
            style={{ marginTop: 4, alignSelf: 'flex-start' }}
          />
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.teal} style={{ marginRight: 8 }} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Determining GPS coordinates...
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.tealMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: 1,
  },
  cachedTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cachedTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  rationaleText: {
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  locationContent: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  areaText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  localityText: {
    color: colors.textSecondary,
    marginBottom: 6,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  coordsText: {
    fontFamily: 'monospace',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaItem: {
    color: colors.textSecondary,
  },
  mapLinkTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapLink: {
    ...typography.captionBold,
    color: colors.teal,
  },
  errorContainer: {
    marginTop: spacing.xs,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
});
