import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../src/theme';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';

export default function PermissionsScreen() {
  const permissions = [
    {
      title: 'Location Services (GPS)',
      icon: 'location-outline' as const,
      color: colors.emergency,
      scope: 'Foreground Geolocation',
      description:
        'ResQHub requests your location strictly when an emergency SOS is triggered. Your real-time coordinates and a Google Maps link are dispatched to your emergency contacts so they can locate you. We never track your movements continuously or sell your location data.',
    },
    {
      title: 'Contacts Access',
      icon: 'people-outline' as const,
      color: colors.teal,
      scope: 'User-Selected Contacts Only',
      description:
        'Allows you to pick up to 5 trusted emergency contacts directly from your device phonebook. ResQHub accesses only the specific contact you choose and never synchronizes or uploads your full address book to any external server.',
    },
    {
      title: 'Accelerometer Motion Sensor',
      icon: 'phone-portrait-outline' as const,
      color: '#B45309',
      scope: 'Hardware Motion Sampling',
      description:
        'Used for the optional shake-detection feature. When enabled in the foreground, physical shaking triggers a 3-second countdown with sound and vibration before dispatching help.',
    },
    {
      title: 'Phone Dialer & Telephony',
      icon: 'call-outline' as const,
      color: '#1D4ED8',
      scope: 'Direct Calling Shortcuts',
      description:
        'Enables one-tap emergency calling to national helplines (112, 108, 100) and your saved emergency contacts using your device phone dialer.',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Permissions & Privacy" showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introBox}>
          <Ionicons name="shield-checkmark" size={32} color={colors.teal} style={{ marginBottom: 8 }} />
          <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center' }]}>
            Your Privacy & Safety
          </Text>
          <Text style={[typography.body, styles.introText]}>
            ResQHub is built with privacy-first principles. We only request permissions necessary to provide life-safety assistance in emergencies.
          </Text>
        </View>

        {permissions.map((p, idx) => (
          <Card key={idx} style={styles.permCard} variant="elevated">
            <View style={styles.permHeader}>
              <View style={[styles.permIconCircle, { backgroundColor: `${p.color}15` }]}>
                <Ionicons name={p.icon} size={22} color={p.color} />
              </View>
              <View style={styles.permTitleCol}>
                <Text style={[typography.bodyBold, styles.permTitle]}>{p.title}</Text>
                <Text style={[typography.caption, { color: p.color, fontWeight: '600' }]}>
                  {p.scope}
                </Text>
              </View>
            </View>
            <Text style={[typography.caption, styles.permDesc]}>{p.description}</Text>
          </Card>
        ))}

        <Card style={styles.guaranteeCard} variant="flat">
          <Text style={[typography.captionBold, styles.guaranteeTitle]}>
            ZERO SECRET MOBILE GUARANTEE
          </Text>
          <Text style={[typography.caption, styles.guaranteeText]}>
            ResQHub does not store third-party SMS API keys, Twilio credentials, or database secrets in the mobile binary. All server-mediated dispatches are processed through our hardened FastAPI backend.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  introBox: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  introText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  permCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  permHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  permIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  permTitleCol: {
    flex: 1,
  },
  permTitle: {
    color: colors.textPrimary,
  },
  permDesc: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  guaranteeCard: {
    backgroundColor: colors.tealMuted,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  guaranteeTitle: {
    color: colors.tealDark,
    letterSpacing: 1,
    marginBottom: 4,
  },
  guaranteeText: {
    color: colors.tealDark,
    lineHeight: 18,
  },
});
