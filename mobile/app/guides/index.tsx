import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../src/theme';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { FIRST_AID_GUIDES } from '../../src/features/guides/guideData';
import { openPhoneDialer } from '../../src/features/alerts/alertService';
import { FirstAidGuide } from '../../src/types';

export default function GuidesScreen() {
  const [selectedGuideId, setSelectedGuideId] = useState<string>(FIRST_AID_GUIDES[0].id);

  const currentGuide: FirstAidGuide =
    FIRST_AID_GUIDES.find((g) => g.id === selectedGuideId) || FIRST_AID_GUIDES[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="First Aid Safety Guides" showBack />

      {/* Category Filter Chips */}
      <View style={styles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {FIRST_AID_GUIDES.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={[
                styles.chip,
                selectedGuideId === g.id && styles.chipActive,
              ]}
              onPress={() => setSelectedGuideId(g.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedGuideId === g.id && styles.chipTextActive,
                ]}
              >
                {g.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Guide Overview Card */}
        <Card style={styles.guideCard} variant="elevated">
          <View style={styles.guideHeader}>
            <View style={styles.guideBadge}>
              <Text style={styles.guideBadgeText}>{currentGuide.category.toUpperCase()}</Text>
            </View>
            <Text style={[typography.h2, styles.guideTitle]}>{currentGuide.title}</Text>
            <Text style={[typography.body, styles.guideDesc]}>{currentGuide.description}</Text>
          </View>

          {/* Critical Warning Callout */}
          {currentGuide.criticalWarning && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color={colors.emergencyDark} />
              <View style={styles.warningTextCol}>
                <Text style={styles.warningTitle}>CRITICAL SAFETY RULE</Text>
                <Text style={styles.warningBody}>{currentGuide.criticalWarning}</Text>
              </View>
            </View>
          )}

          {/* Step-by-Step Instructions */}
          <Text style={styles.stepsHeader}>ACTION STEPS</Text>
          {currentGuide.steps.map((step, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View style={styles.stepLetterCircle}>
                <Text style={styles.stepLetter}>{step.letter}</Text>
              </View>
              <View style={styles.stepTextCol}>
                <Text style={[typography.bodyBold, styles.stepTitle]}>{step.title}</Text>
                <Text style={[typography.body, styles.stepDesc]}>{step.description}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Emergency Call Action */}
        <Card style={styles.emergencyCallCard} variant="flat">
          <View style={styles.callRow}>
            <View style={styles.callTextCol}>
              <Text style={[typography.bodyBold, { color: colors.emergencyDark }]}>
                Condition Not Improving?
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Do not hesitate to contact professional ambulance responders.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => openPhoneDialer('108')}
            >
              <Ionicons name="call" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.callBtnText}>Call 108</Text>
            </TouchableOpacity>
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
  chipsContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  chipsScroll: {
    paddingHorizontal: spacing.gutter,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: spacing.borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  chipText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  content: {
    padding: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  guideCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  guideHeader: {
    marginBottom: spacing.md,
  },
  guideBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: spacing.borderRadius.xs,
    marginBottom: spacing.xs,
  },
  guideBadgeText: {
    ...typography.captionBold,
    color: colors.tealDark,
    fontSize: 10,
    letterSpacing: 1,
  },
  guideTitle: {
    color: colors.textPrimary,
    marginTop: 2,
  },
  guideDesc: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: colors.emergencyMuted,
    borderRadius: spacing.borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  warningTextCol: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  warningTitle: {
    ...typography.captionBold,
    color: colors.emergencyDark,
    letterSpacing: 0.5,
  },
  warningBody: {
    ...typography.caption,
    color: colors.emergencyDark,
    marginTop: 2,
    lineHeight: 18,
  },
  stepsHeader: {
    ...typography.captionBold,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  stepLetterCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.tealMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  stepLetter: {
    ...typography.captionBold,
    color: colors.tealDark,
    fontSize: 14,
  },
  stepTextCol: {
    flex: 1,
  },
  stepTitle: {
    color: colors.textPrimary,
  },
  stepDesc: {
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 20,
  },
  emergencyCallCard: {
    backgroundColor: colors.emergencyMuted,
    padding: spacing.md,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.emergencyDark,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadius.md,
  },
  callBtnText: {
    ...typography.buttonSmall,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
