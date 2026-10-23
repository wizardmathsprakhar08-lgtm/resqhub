import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../src/theme';
import { useSosMonitor } from '../../src/features/alerts/useSosMonitor';
import {
  openNativeSmsFallback,
  openPhoneDialer,
} from '../../src/features/alerts/alertService';
import { openDeviceSettings } from '../../src/features/location/locationService';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { StatusBadge } from '../../src/components/StatusBadge';

export default function ActiveAlertScreen() {
  const router = useRouter();
  const {
    session,
    resolveAlert,
    clearSession,
    contacts,
    retryDispatch,
    retryLocation,
    callPrimaryEmergencyNumber,
    isSending,
    isLocating,
  } = useSosMonitor();
  const [isResolving, setIsResolving] = useState(false);

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>No Active Alert</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
            There is currently no ongoing SOS alert session.
          </Text>
          <Button
            title="Return to Home"
            variant="accent"
            onPress={() => router.replace('/(tabs)')}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const { state, message, location, recipients, error } = session;

  const handleResolveAlert = () => {
    Alert.alert(
      'Resolve Emergency Alert',
      'Are you safe and would you like to mark this active emergency alert as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I Am Safe Now',
          style: 'default',
          onPress: async () => {
            setIsResolving(true);
            await resolveAlert('User marked safe from client');
            setIsResolving(false);
          },
        },
      ]
    );
  };

  const handleDismissResolved = () => {
    clearSession();
    router.replace('/(tabs)');
  };

  const getStatusColor = () => {
    switch (state) {
      case 'locating':
      case 'sending':
        return { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' };
      case 'sent':
        return { bg: colors.tealMuted, text: colors.tealDark, border: colors.tealLight };
      case 'mock':
        return { bg: '#FEF3C7', text: '#B45309', border: '#F59E0B' };
      case 'partial_failure':
        return { bg: '#FEF3C7', text: '#B45309', border: '#F59E0B' };
      case 'failed':
        return { bg: colors.emergencyMuted, text: colors.emergencyDark, border: colors.emergencyLight };
      case 'resolved':
        return { bg: colors.tealMuted, text: colors.tealDark, border: colors.teal };
      default:
        return { bg: colors.backgroundSecondary, text: colors.textSecondary, border: colors.border };
    }
  };

  const statusStyle = getStatusColor();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Banner */}
      <View style={[styles.banner, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
        <View style={styles.bannerRow}>
          {state === 'locating' || state === 'sending' || isSending ? (
            <ActivityIndicator size="small" color={statusStyle.text} style={{ marginRight: 8 }} />
          ) : (
            <Ionicons
              name={
                state === 'sent' || state === 'resolved'
                  ? 'checkmark-circle'
                  : state === 'mock' || state === 'partial_failure'
                  ? 'alert-circle'
                  : 'close-circle'
              }
              size={22}
              color={statusStyle.text}
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={[typography.bodyBold, { color: statusStyle.text, flex: 1 }]}>
            {state === 'locating' && 'Acquiring GPS Position...'}
            {state === 'sending' && 'Submitting Emergency SMS via SIM...'}
            {state === 'sent' && 'Alert Dispatched via Cellular SIM'}
            {state === 'mock' && 'Simulated Alert Dispatched (Mock SMS Mode)'}
            {state === 'partial_failure' && 'Partial Delivery — Some Contacts Failed'}
            {state === 'failed' && 'Dispatch Failed — Use Offline Fallback'}
            {state === 'resolved' && 'Alert Marked Resolved'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Error Detail Card (Shown on failure or partial failure) */}
        {error ? (
          <Card style={[styles.card, { borderColor: colors.emergency, backgroundColor: colors.emergencyMuted }]} variant="outlined">
            <View style={styles.errorHeader}>
              <Ionicons name="warning-outline" size={20} color={colors.emergencyDark} />
              <Text style={[typography.bodyBold, { color: colors.emergencyDark, marginLeft: 8 }]}>
                Dispatch Issue Detected
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.emergencyDark, marginTop: 4 }]}>
              {error}
            </Text>
            {error.includes('10.0.2.2') || error.includes('network') || error.includes('timed out') ? (
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6, fontStyle: 'italic' }]}>
                Tip: If testing on a physical phone via Expo Go, open Settings and change the Backend URL to your computer's Wi-Fi IP (e.g. http://192.168.1.xxx:8000/api/v1).
              </Text>
            ) : null}

            {error.includes('Expo Go') || error.includes('development build') ? (
              <Text style={[typography.caption, { color: colors.emergencyDark, marginTop: 6, fontWeight: '600' }]}>
                Notice: Native direct SIM SMS cannot execute inside the standard Expo Go app. To test automated cellular sending, compile and install the ResQHub development build APK. You can use the manual SMS composer fallback below to send your alert immediately.
              </Text>
            ) : null}

            {error.includes('permission') || error.includes('SEND_SMS') ? (
              <View style={{ marginTop: spacing.sm }}>
                <Button
                  title="Open App Settings to Enable SMS"
                  variant="outline"
                  size="small"
                  onPress={openDeviceSettings}
                  style={{ marginBottom: spacing.xs }}
                />
              </View>
            ) : null}

            {state === 'failed' || state === 'partial_failure' ? (
              <Button
                title={isSending ? 'Retrying...' : 'Retry SIM Dispatch'}
                variant="accent"
                size="small"
                loading={isSending}
                onPress={retryDispatch}
                style={{ marginTop: spacing.sm }}
              />
            ) : null}
          </Card>
        ) : null}

        {/* GPS Coordinates & Location Card */}
        <Card style={styles.card} variant="elevated">
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={22} color={colors.emergency} />
            <Text style={[typography.bodyBold, styles.cardTitle]}>Emergency Location Details</Text>
            {location ? (
              <View style={location.isCached ? styles.cachedBadge : styles.liveBadge}>
                <Text style={location.isCached ? styles.cachedBadgeText : styles.liveBadgeText}>
                  {location.isCached ? 'CACHED POSITION' : 'LIVE GPS FIX'}
                </Text>
              </View>
            ) : null}
          </View>

          {location ? (
            <View style={styles.locationBody}>
              {location.readableAddress?.area ? (
                <Text style={[typography.bodyBold, { color: colors.textPrimary, marginBottom: 2 }]}>
                  {location.readableAddress.area}
                </Text>
              ) : null}

              {location.readableAddress?.city || location.readableAddress?.state ? (
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>
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
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>
                  {location.readableAddress.formattedAddress}
                </Text>
              ) : (
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4, fontStyle: 'italic' }]}>
                  Reverse geocoding unavailable — raw coordinates attached to alert
                </Text>
              )}

              <Text style={[typography.body, styles.coordsText]}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
              {location.accuracy != null ? (
                <Text style={[typography.caption, styles.accuracyText]}>
                  Accuracy: ±{Math.round(location.accuracy)} meters
                </Text>
              ) : null}

              {location.isCached ? (
                <Text style={[typography.caption, { color: '#B45309', marginTop: 2 }]}>
                  Recorded at {new Date(location.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
              ) : null}

              <TouchableOpacity
                style={styles.mapLinkBtn}
                onPress={() => Linking.openURL(location.mapUrl)}
              >
                <Ionicons name="map-outline" size={16} color={colors.teal} style={{ marginRight: 6 }} />
                <Text style={styles.mapLinkText}>Open Location in Google Maps</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.locationPending}>
              {state === 'locating' || isLocating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.teal} style={{ marginRight: 8 }} />
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Acquiring satellite coordinates & address...
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={[typography.caption, { color: colors.emergency }]}>
                    GPS unavailable or timed out. Alert dispatched with location unavailable notice.
                  </Text>
                  <Button
                    title={isLocating ? 'Acquiring GPS...' : 'Retry GPS Fix'}
                    variant="outline"
                    size="small"
                    loading={isLocating}
                    onPress={() => retryLocation()}
                    style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
                  />
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Emergency Dispatch Channel & Ledger Status Card */}
        <Card style={styles.card} variant="elevated">
          <View style={styles.cardHeader}>
            <Ionicons name="hardware-chip-outline" size={20} color={colors.teal} />
            <Text style={[typography.bodyBold, styles.cardTitle]}>
              Emergency Dispatch Channel
            </Text>
            <StatusBadge
              label={
                state === 'mock'
                  ? 'Mock Mode'
                  : state === 'sent'
                  ? 'Direct SIM Sent'
                  : state === 'partial_failure'
                  ? 'Partial Delivery'
                  : state === 'failed'
                  ? 'SIM / Gate Error'
                  : state === 'locating'
                  ? 'Locating...'
                  : state === 'sending'
                  ? 'Submitting...'
                  : 'Resolved'
              }
              status={
                state === 'sent' || state === 'resolved'
                  ? 'active'
                  : state === 'mock' || state === 'partial_failure'
                  ? 'warning'
                  : state === 'failed'
                  ? 'error'
                  : 'neutral'
              }
            />
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            {session.alertId.startsWith('local_sim_')
              ? 'Primary Channel: Direct Cellular SIM (Device Native)'
              : session.alertId.startsWith('local_')
              ? 'Primary Channel: Local Device Offline Storage'
              : 'Primary Channel: Direct SIM & Backend Ledger Synchronized'}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 1, fontSize: 11 }]}>
            Alert Tracking ID: {session.alertId}
          </Text>
        </Card>

        {/* Emergency Message Card */}
        <Card style={styles.card} variant="elevated">
          <View style={styles.cardHeader}>
            <Ionicons name="mail-outline" size={20} color={colors.teal} />
            <Text style={[typography.bodyBold, styles.cardTitle]}>Emergency Message Payload</Text>
          </View>
          <Text style={[typography.caption, styles.messageContent]}>{message}</Text>
        </Card>

        {/* Recipients & Real Delivery Status Ledger */}
        <Card style={styles.card} variant="elevated">
          <View style={styles.cardHeader}>
            <Ionicons name="people-outline" size={20} color={colors.teal} />
            <Text style={[typography.bodyBold, styles.cardTitle]}>
              Emergency Contacts Ledger ({recipients.length})
            </Text>
          </View>

          {recipients.map((r) => (
            <View key={r.contactId} style={styles.recipientRow}>
              <View style={styles.recipientInfo}>
                <Text style={[typography.bodyBold, styles.recipientName]}>{r.contactName}</Text>
                <Text style={[typography.caption, styles.recipientPhone]}>{r.phoneNumber}</Text>
                {r.errorMessage ? (
                  <Text style={[typography.caption, { color: colors.emergency, fontSize: 11 }]}>
                    {r.errorMessage}
                  </Text>
                ) : null}
              </View>

              <View style={styles.recipientStatusCol}>
                <StatusBadge
                  label={
                    r.status === 'delivered'
                      ? 'Delivered'
                      : r.status === 'sent'
                      ? 'Accepted'
                      : r.status === 'queued'
                      ? 'Queued'
                      : r.status === 'mock'
                      ? 'Simulated (Mock)'
                      : 'Failed'
                  }
                  status={
                    r.status === 'delivered' || r.status === 'sent'
                      ? 'active'
                      : r.status === 'queued' || r.status === 'mock'
                      ? 'warning'
                      : 'error'
                  }
                />
              </View>
            </View>
          ))}

          {state === 'mock' ? (
            <View style={styles.mockNoticeBox}>
              <Ionicons name="flask-outline" size={16} color="#B45309" style={{ marginRight: 6 }} />
              <Text style={styles.mockNoticeText}>
                Backend is currently running in MOCK_SMS_PROVIDER mode. SMS dispatches are simulated on the server log and not transmitted over cellular networks. To enable real SMS delivery, configure Twilio credentials in backend/.env.
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Calling Shortcut Section */}
        <View style={styles.callSection}>
          <Text style={styles.fallbackTitle}>ONE-TAP EMERGENCY CALL (ACTION_DIAL)</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            Opens your device dialer with the number pre-filled. Press Call on your keypad to connect. (Note: Android requires manual user confirmation for outbound telephone calls).
          </Text>
          <Button
            title="Open Dialer with 112 (National Line)"
            variant="emergency"
            onPress={callPrimaryEmergencyNumber}
            style={{ marginBottom: spacing.sm }}
          />

          <View style={styles.quickDialRow}>
            <TouchableOpacity
              style={[styles.quickDialBtn, { backgroundColor: '#FEE2E2' }]}
              onPress={() => openPhoneDialer('112')}
            >
              <Ionicons name="call" size={16} color={colors.emergencyDark} />
              <Text style={[styles.quickDialText, { color: colors.emergencyDark }]}>112 (National)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickDialBtn, { backgroundColor: '#DBEAFE' }]}
              onPress={() => openPhoneDialer('108')}
            >
              <Ionicons name="medical" size={16} color="#1D4ED8" />
              <Text style={[styles.quickDialText, { color: '#1D4ED8' }]}>108 (Ambulance)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickDialBtn, { backgroundColor: '#FEF3C7' }]}
              onPress={() => openPhoneDialer('100')}
            >
              <Ionicons name="shield" size={16} color="#B45309" />
              <Text style={[styles.quickDialText, { color: '#B45309' }]}>100 (Police)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Offline Fallback Options — shown if automated cellular dispatch failed or in Expo Go */}
        {state === 'failed' || state === 'partial_failure' ? (
          <View style={styles.fallbackSection}>
            <Text style={styles.fallbackTitle}>EMERGENCY SMS FALLBACK</Text>
            <Text style={styles.fallbackSubtitle}>
              Automated SIM dispatch could not complete on this device/runtime. You can launch your device SMS composer with prefilled location coordinates to send manually via your cellular SIM:
            </Text>

            <Button
              title="Compose SMS via SIM (Manual Send)"
              variant="outline"
              onPress={() => openNativeSmsFallback(contacts, message, location?.mapUrl)}
              style={{ marginBottom: spacing.sm }}
            />
          </View>
        ) : null}

        {/* Resolution Actions */}
        <View style={styles.actionContainer}>
          {state !== 'resolved' ? (
            <Button
              title="I AM SAFE — RESOLVE ALERT"
              variant="accent"
              size="large"
              loading={isResolving}
              onPress={handleResolveAlert}
              style={styles.resolveBtn}
            />
          ) : (
            <Button
              title="Return to Dashboard"
              variant="primary"
              size="large"
              onPress={handleDismissResolved}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  banner: {
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    padding: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  card: {
    marginBottom: spacing.md,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    marginLeft: 8,
    flex: 1,
  },
  cachedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.borderRadius.sm,
  },
  cachedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  liveBadge: {
    backgroundColor: colors.tealMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.borderRadius.sm,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.tealDark,
    letterSpacing: 0.5,
  },
  mockNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: spacing.sm,
    borderRadius: spacing.borderRadius.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  mockNoticeText: {
    ...typography.caption,
    color: '#B45309',
    flex: 1,
    lineHeight: 16,
  },
  locationBody: {
    marginTop: spacing.xs,
  },
  coordsText: {
    fontFamily: 'monospace',
    color: colors.textPrimary,
    fontWeight: '600',
  },
  accuracyText: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  mapLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  mapLinkText: {
    ...typography.captionBold,
    color: colors.teal,
  },
  locationPending: {
    paddingVertical: spacing.xs,
  },
  messageContent: {
    color: colors.textPrimary,
    fontFamily: 'monospace',
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.sm,
    borderRadius: spacing.borderRadius.sm,
    lineHeight: 18,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    color: colors.textPrimary,
  },
  recipientPhone: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  recipientStatusCol: {
    marginLeft: spacing.sm,
  },
  callSection: {
    marginVertical: spacing.sm,
  },
  fallbackSection: {
    marginVertical: spacing.md,
    backgroundColor: '#FFFBEB',
    padding: spacing.md,
    borderRadius: spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  fallbackTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  fallbackSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  quickDialRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickDialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadius.md,
  },
  quickDialText: {
    ...typography.captionBold,
    marginLeft: 4,
  },
  actionContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  resolveBtn: {
    backgroundColor: colors.tealDark,
  },
});
