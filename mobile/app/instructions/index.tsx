import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../src/theme';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';

export default function InstructionsScreen() {
  const steps = [
    {
      num: 1,
      title: 'Adding Emergency Contacts',
      icon: 'person-add-outline' as const,
      color: colors.teal,
      body: 'Navigate to the Contacts tab and tap "+ Add". You can select contacts directly from your device phonebook or type them in manually. Add up to 5 trusted individuals.',
    },
    {
      num: 2,
      title: 'Managing Registered Numbers',
      icon: 'people-outline' as const,
      color: '#1D4ED8',
      body: 'View all saved contacts in the Contacts list. You can trigger an instant phone call with the green phone icon or remove a contact using the trash icon.',
    },
    {
      num: 3,
      title: 'Customizing Emergency Message',
      icon: 'chatbubble-ellipses-outline' as const,
      color: '#7E22CE',
      body: 'Open Settings → Emergency Message. Personalize your message text. Your real-time coordinates and a clickable Google Maps link will be automatically appended.',
    },
    {
      num: 4,
      title: 'Accessing National Helplines',
      icon: 'call-outline' as const,
      color: '#B45309',
      body: 'Explore the Helplines tab for one-tap calling to emergency response agencies across India: Ambulance (108), Police (100), Fire (101), Disaster (1078), and Gas Leaks (1906).',
    },
    {
      num: 5,
      title: 'First Aid Safety Guides',
      icon: 'medkit-outline' as const,
      color: colors.emergency,
      body: 'Access the First Aid Guides anytime from the home screen or settings. Review step-by-step instructions for burns, bone fractures, bleeding control, and choking without needing an internet connection.',
    },
    {
      num: 6,
      title: 'Activating Emergency SOS & Shake',
      icon: 'warning-outline' as const,
      color: colors.emergencyDark,
      body: 'Press and hold the prominent SOS button for 1.5 seconds, or enable "Shake Detection Monitor" in Settings. Both actions enter a 5-second countdown with vibration and sound alerts, allowing you to cancel accidental activations before messages dispatch.',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="User Manual & Instructions" showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introBox}>
          <Text style={[typography.h2, styles.introTitle]}>
            How to Use ResQHub
          </Text>
          <Text style={[typography.body, styles.introBody]}>
            ResQHub is designed to provide rapid, reliable assistance in personal safety crises. Follow these essential steps to ensure you are fully protected.
          </Text>
        </View>

        {steps.map((s) => (
          <Card key={s.num} style={styles.card} variant="elevated">
            <View style={styles.cardHeader}>
              <View style={[styles.numBadge, { backgroundColor: s.color }]}>
                <Text style={styles.numBadgeText}>{s.num}</Text>
              </View>
              <View style={styles.titleCol}>
                <Text style={[typography.bodyBold, styles.stepTitle]}>{s.title}</Text>
              </View>
              <Ionicons name={s.icon} size={22} color={s.color} />
            </View>
            <Text style={[typography.body, styles.stepBody]}>{s.body}</Text>
          </Card>
        ))}

        <Card style={styles.tipCard} variant="flat">
          <Ionicons name="bulb-outline" size={24} color={colors.tealDark} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.captionBold, { color: colors.tealDark }]}>
              CRITICAL FIELD TIP
            </Text>
            <Text style={[typography.caption, { color: colors.tealDark, marginTop: 2 }]}>
              Keep Location (GPS) turned ON in your device system settings to ensure your emergency contacts receive accurate coordinates during an SOS.
            </Text>
          </View>
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
    marginBottom: spacing.lg,
  },
  introTitle: {
    color: colors.textPrimary,
  },
  introBody: {
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 22,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  numBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  numBadgeText: {
    ...typography.captionBold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  titleCol: {
    flex: 1,
  },
  stepTitle: {
    color: colors.textPrimary,
  },
  stepBody: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tealMuted,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
});
