import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../src/theme';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { StatusBadge } from '../../src/components/StatusBadge';
import { EmptyState } from '../../src/components/EmptyState';
import { getAlertHistory } from '../../src/database/db';
import { AlertHistoryItem } from '../../src/types';

export default function AlertHistoryScreen() {
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);

  useEffect(() => {
    const list = getAlertHistory();
    setHistory(list);
  }, []);

  const renderItem = ({ item }: { item: AlertHistoryItem }) => {
    const formattedDate = new Date(item.createdAt).toLocaleString();

    return (
      <Card style={styles.card} variant="elevated">
        <View style={styles.cardHeader}>
          <StatusBadge
            label={item.status.toUpperCase()}
            status={
              item.status === 'sent' || item.status === 'resolved'
                ? 'active'
                : item.status === 'failed'
                ? 'error'
                : 'warning'
            }
          />
          <Text style={[typography.caption, styles.dateText]}>{formattedDate}</Text>
        </View>

        <Text style={[typography.body, styles.messageText]} numberOfLines={2}>
          "{item.message}"
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>{item.recipientsCount} contacts</Text>
          </View>

          {item.mapUrl ? (
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() => Linking.openURL(item.mapUrl!)}
            >
              <Ionicons name="location-outline" size={16} color={colors.teal} />
              <Text style={styles.mapBtnText}>View Map</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>No GPS</Text>
            </View>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Alert History & Ledger" showBack />

      {history.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No Emergency Alerts Logged"
          description="When you trigger an emergency SOS, the dispatch details, coordinates, and recipient outcomes will be recorded here."
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dateText: {
    color: colors.textMuted,
  },
  messageText: {
    color: colors.textPrimary,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapBtnText: {
    ...typography.captionBold,
    color: colors.teal,
    marginLeft: 4,
  },
});
