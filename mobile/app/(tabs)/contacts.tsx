import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../src/theme';
import { useSosMonitor } from '../../src/features/alerts/useSosMonitor';
import { deleteContact, MAX_CONTACTS } from '../../src/features/contacts/contactsService';
import { openPhoneDialer } from '../../src/features/alerts/alertService';
import { EmptyState } from '../../src/components/EmptyState';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { EmergencyContact } from '../../src/types';

export default function ContactsScreen() {
  const router = useRouter();
  const { contacts, contactsCount, refreshContacts } = useSosMonitor();

  useFocusEffect(
    useCallback(() => {
      refreshContacts();
    }, [refreshContacts])
  );

  const handleDelete = (contact: EmergencyContact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to remove ${contact.name} from your emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const ok = deleteContact(contact.id);
            if (ok) {
              refreshContacts();
            } else {
              Alert.alert('Error', 'Failed to delete contact from local database.');
            }
          },
        },
      ]
    );
  };

  const renderContactItem = ({ item }: { item: EmergencyContact }) => (
    <Card style={styles.contactCard} variant="elevated">
      <View style={styles.contactRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={[typography.bodyBold, styles.nameText]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[typography.caption, styles.numberText]}>{item.number}</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtnCall}
            onPress={() => openPhoneDialer(item.number)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${item.name}`}
          >
            <Ionicons name="call" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnDelete}
            onPress={() => handleDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
          >
            <Ionicons name="trash-outline" size={18} color={colors.emergency} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[typography.h1, styles.headerTitle]}>Emergency Contacts</Text>
          <Text style={[typography.caption, styles.headerSubtitle]}>
            {contactsCount} of {MAX_CONTACTS} trusted contacts registered
          </Text>
        </View>

        {contactsCount < MAX_CONTACTS && (
          <Button
            title="+ Add"
            size="small"
            variant="accent"
            onPress={() => router.push('/contacts/add')}
          />
        )}
      </View>

      {contacts.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No Emergency Contacts"
          description="Add up to 5 trusted family members or friends. During an emergency, your SOS message and live coordinates will be sent to them."
          actionTitle="+ Add First Contact"
          onAction={() => router.push('/contacts/add')}
        />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContactItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <View style={styles.noticeBox}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.teal} />
              <Text style={styles.noticeText}>
                Contacts are stored locally on your device. ResQHub will never upload your full address book to external servers.
              </Text>
            </View>
          }
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    color: colors.primary,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    padding: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  contactCard: {
    marginBottom: spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tealMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarLetter: {
    ...typography.h3,
    color: colors.tealDark,
  },
  infoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  nameText: {
    color: colors.textPrimary,
  },
  numberText: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionBtnCall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDelete: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.emergencyMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  noticeText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
});
