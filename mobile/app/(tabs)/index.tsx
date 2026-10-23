import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../src/theme';
import { useSosMonitor } from '../../src/features/alerts/useSosMonitor';
import { SosButton } from '../../src/components/SosButton';
import { CountdownModal } from '../../src/components/CountdownModal';
import { StatusBadge } from '../../src/components/StatusBadge';
import { Card } from '../../src/components/Card';
import { CurrentLocationCard } from '../../src/components/CurrentLocationCard';
import { openPhoneDialer } from '../../src/features/alerts/alertService';
import { SOS_COUNTDOWN_SECONDS } from '../../src/constants/timing';

export default function HomeScreen() {
  const router = useRouter();
  const {
    contactsCount,
    isMonitoring,
    showCountdown,
    toggleMonitoring,
    triggerSos,
    cancelCountdown,
    executeSosDispatch,
  } = useSosMonitor();

  const handleToggleMonitoring = () => {
    const result = toggleMonitoring();
    if (!result.success) {
      Alert.alert(
        'Emergency Contacts Required',
        result.error || 'Please add at least one contact before starting monitoring.',
        [
          { text: 'Add Contact', onPress: () => router.push('/contacts/add') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleSosPress = () => {
    const result = triggerSos();
    if (!result.success) {
      Alert.alert('Contacts Needed', result.error, [
        { text: 'Add Emergency Contact', onPress: () => router.push('/contacts/add') },
        { text: 'Dismiss', style: 'cancel' },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View>
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={[typography.h1, styles.brandTitle]}>ResQHub</Text>
            </View>
            <Text style={[typography.caption, styles.brandSubtitle]}>
              Emergency Response & Personal Safety
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => router.push('/guides')}
              accessibilityRole="button"
              accessibilityLabel="First aid guides"
            >
              <Ionicons name="medkit-outline" size={22} color={colors.teal} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => router.push('/instructions')}
              accessibilityRole="button"
              accessibilityLabel="User manual and guide"
            >
              <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Monitoring & Readiness Card */}
        <Card style={styles.statusCard} variant="elevated">
          <View style={styles.statusHeader}>
            <View style={styles.statusTextCol}>
              <Text style={styles.cardHeaderTitle}>Shake Detection Monitor</Text>
              <Text style={styles.cardHeaderSubtitle}>
                {isMonitoring
                  ? 'Active in foreground: shake device firmly to trigger SOS'
                  : 'Monitoring inactive: tap toggle to protect your device'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.togglePill,
                isMonitoring ? styles.togglePillActive : styles.togglePillInactive,
              ]}
              onPress={handleToggleMonitoring}
              accessibilityRole="switch"
              accessibilityLabel={`Shake monitoring is ${isMonitoring ? 'Active' : 'Inactive'}. Tap to toggle.`}
            >
              <Ionicons
                name={isMonitoring ? 'checkmark-circle' : 'power'}
                size={18}
                color={isMonitoring ? colors.tealDark : colors.textSecondary}
              />
              <Text
                style={[
                  styles.togglePillText,
                  isMonitoring ? styles.toggleTextActive : styles.toggleTextInactive,
                ]}
              >
                {isMonitoring ? 'Active' : 'Inactive'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statusBadgesRow}>
            <StatusBadge
              label={`${contactsCount}/5 Contacts`}
              status={contactsCount > 0 ? 'active' : 'warning'}
            />
            <StatusBadge label="GPS Ready" status="neutral" />
            <StatusBadge
              label={isMonitoring ? 'Shake Armed' : 'Shake Idle'}
              status={isMonitoring ? 'active' : 'inactive'}
            />
          </View>
        </Card>

        {/* Real-time Location Card */}
        <CurrentLocationCard />

        {/* Centerpiece SOS Button */}
        <SosButton onTrigger={handleSosPress} />

        {/* Quick Helplines Dial Row */}
        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, styles.sectionTitle]}>Quick Emergency Call</Text>
          <TouchableOpacity onPress={() => router.push('/helplines')}>
            <Text style={[typography.captionBold, { color: colors.teal }]}>View All (8)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.helplinesRow}>
          <TouchableOpacity
            style={[styles.helplineChip, { backgroundColor: '#FEE2E2' }]}
            onPress={() => openPhoneDialer('112')}
            accessibilityRole="button"
            accessibilityLabel="Call National Emergency 112"
          >
            <Ionicons name="alert-circle" size={20} color={colors.emergencyDark} />
            <Text style={[styles.helplineChipTitle, { color: colors.emergencyDark }]}>112</Text>
            <Text style={styles.helplineChipSub}>National</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.helplineChip, { backgroundColor: '#DBEAFE' }]}
            onPress={() => openPhoneDialer('108')}
            accessibilityRole="button"
            accessibilityLabel="Call Ambulance 108"
          >
            <Ionicons name="medical" size={20} color="#1D4ED8" />
            <Text style={[styles.helplineChipTitle, { color: '#1D4ED8' }]}>108</Text>
            <Text style={styles.helplineChipSub}>Ambulance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.helplineChip, { backgroundColor: '#FEF3C7' }]}
            onPress={() => openPhoneDialer('100')}
            accessibilityRole="button"
            accessibilityLabel="Call Police 100"
          >
            <Ionicons name="car" size={20} color="#B45309" />
            <Text style={[styles.helplineChipTitle, { color: '#B45309' }]}>100</Text>
            <Text style={styles.helplineChipSub}>Police</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Navigation Cards */}
        <View style={styles.cardsGrid}>
          <Card
            style={styles.navCard}
            onPress={() => router.push('/contacts/add')}
            variant="outlined"
          >
            <View style={styles.navCardIconBox}>
              <Ionicons name="person-add" size={24} color={colors.teal} />
            </View>
            <Text style={[typography.bodyBold, styles.navCardTitle]}>
              Add Contact
            </Text>
            <Text style={[typography.caption, styles.navCardSub]}>
              Manual or Phonebook ({contactsCount}/5)
            </Text>
          </Card>

          <Card
            style={styles.navCard}
            onPress={() => router.push('/settings/message')}
            variant="outlined"
          >
            <View style={styles.navCardIconBox}>
              <Ionicons name="chatbox-ellipses" size={24} color={colors.teal} />
            </View>
            <Text style={[typography.bodyBold, styles.navCardTitle]}>
              Edit Message
            </Text>
            <Text style={[typography.caption, styles.navCardSub]}>
              Customize SOS SMS
            </Text>
          </Card>

          <Card
            style={styles.navCard}
            onPress={() => router.push('/guides')}
            variant="outlined"
          >
            <View style={styles.navCardIconBox}>
              <Ionicons name="fitness" size={24} color={colors.teal} />
            </View>
            <Text style={[typography.bodyBold, styles.navCardTitle]}>
              First Aid
            </Text>
            <Text style={[typography.caption, styles.navCardSub]}>
              Burns, Bleeding & Bones
            </Text>
          </Card>

          <Card
            style={styles.navCard}
            onPress={() => router.push('/settings/history')}
            variant="outlined"
          >
            <View style={styles.navCardIconBox}>
              <Ionicons name="time" size={24} color={colors.teal} />
            </View>
            <Text style={[typography.bodyBold, styles.navCardTitle]}>
              Alert Ledger
            </Text>
            <Text style={[typography.caption, styles.navCardSub]}>
              Past SOS history
            </Text>
          </Card>
        </View>
      </ScrollView>

      {/* 3-Second Cancellation Countdown Overlay */}
      <CountdownModal
        visible={showCountdown}
        onCancel={cancelCountdown}
        onComplete={executeSosDispatch}
        durationSeconds={SOS_COUNTDOWN_SECONDS}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.teal,
    marginRight: 8,
  },
  brandTitle: {
    color: colors.primary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    marginBottom: spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  statusTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardHeaderTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  cardHeaderSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: spacing.borderRadius.full,
    borderWidth: 1,
  },
  togglePillActive: {
    backgroundColor: colors.tealMuted,
    borderColor: colors.teal,
  },
  togglePillInactive: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.borderDark,
  },
  togglePillText: {
    ...typography.captionBold,
    fontSize: 12,
    marginLeft: 4,
  },
  toggleTextActive: {
    color: colors.tealDark,
  },
  toggleTextInactive: {
    color: colors.textSecondary,
  },
  statusBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
  },
  helplinesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  helplineChip: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helplineChipTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  helplineChipSub: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  navCard: {
    width: '48.5%',
    padding: spacing.md,
  },
  navCardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.tealMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  navCardTitle: {
    color: colors.textPrimary,
  },
  navCardSub: {
    color: colors.textMuted,
    marginTop: 2,
  },
});
