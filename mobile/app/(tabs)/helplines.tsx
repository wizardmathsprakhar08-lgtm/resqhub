import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../src/theme';
import { EMERGENCY_HELPLINES } from '../../src/features/helplines/helplineData';
import { openPhoneDialer } from '../../src/features/alerts/alertService';
import { Card } from '../../src/components/Card';
import { HelplineItem } from '../../src/types';

export default function HelplinesScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHelplines = EMERGENCY_HELPLINES.filter((h) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      h.title.toLowerCase().includes(q) ||
      h.number.includes(q) ||
      h.description.toLowerCase().includes(q) ||
      h.category.toLowerCase().includes(q)
    );
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'medical':
        return { bg: '#DBEAFE', text: '#1D4ED8', icon: 'medical' as const };
      case 'police':
        return { bg: '#FEF3C7', text: '#B45309', icon: 'shield-outline' as const };
      case 'fire':
        return { bg: '#FEE2E2', text: '#B91C1C', icon: 'flame-outline' as const };
      case 'disaster':
        return { bg: '#E0E7FF', text: '#4338CA', icon: 'warning-outline' as const };
      case 'utility':
        return { bg: '#F3E8FF', text: '#7E22CE', icon: 'construct-outline' as const };
      case 'general':
      default:
        return { bg: colors.tealMuted, text: colors.tealDark, icon: 'call-outline' as const };
    }
  };

  const renderHelpline = ({ item }: { item: HelplineItem }) => {
    const scheme = getCategoryColor(item.category);

    return (
      <Card style={styles.card} variant="elevated">
        <View style={styles.cardRow}>
          <View style={[styles.iconBox, { backgroundColor: scheme.bg }]}>
            <Ionicons name={scheme.icon} size={24} color={scheme.text} />
          </View>

          <View style={styles.infoCol}>
            <Text style={[typography.bodyBold, styles.titleText]}>{item.title}</Text>
            <Text style={[typography.caption, styles.descText]} numberOfLines={2}>
              {item.description}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.callButton}
            onPress={() => openPhoneDialer(item.number)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${item.title} on ${item.number}`}
          >
            <Ionicons name="call" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.callButtonText}>{item.number}</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.h1, styles.headerTitle]}>Emergency Helplines</Text>
        <Text style={[typography.caption, styles.headerSubtitle]}>
          Verified national emergency response lines across India
        </Text>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ambulance, police, disaster, gas..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <FlatList
        data={filteredHelplines}
        keyExtractor={(item) => item.id}
        renderItem={renderHelpline}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.primary,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: spacing.borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  listContent: {
    padding: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  titleText: {
    color: colors.textPrimary,
  },
  descText: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.teal,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadius.md,
    minHeight: spacing.touchTarget,
  },
  callButtonText: {
    ...typography.buttonSmall,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
