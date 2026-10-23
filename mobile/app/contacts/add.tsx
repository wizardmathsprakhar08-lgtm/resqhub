import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../src/theme';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import {
  insertContact,
  pickContactFromDevice,
  validatePhoneNumber,
  getContactsCount,
  MAX_CONTACTS,
} from '../../src/features/contacts/contactsService';

export default function AddContactScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleDevicePick = async () => {
    const count = getContactsCount();
    if (count >= MAX_CONTACTS) {
      Alert.alert('Contact Limit Reached', `You can add a maximum of ${MAX_CONTACTS} emergency contacts.`);
      return;
    }

    setIsPicking(true);
    const result = await pickContactFromDevice();
    setIsPicking(false);

    if (result.success && result.name && result.phone) {
      setName(result.name);
      setPhone(result.phone);
    } else if (result.permissionDenied) {
      Alert.alert(
        'Permission Required',
        'Contacts permission is required to select from phonebook. You can still enter contact details manually below.'
      );
    } else if (result.error && result.error !== 'Contact selection cancelled.') {
      Alert.alert('Notice', result.error);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a contact name.');
      return;
    }

    const validation = validatePhoneNumber(phone);
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.error || 'Please enter a valid phone number.');
      return;
    }

    setIsSaving(true);
    const result = insertContact(name, phone);
    setIsSaving(false);

    if (result.success) {
      Alert.alert('Success', `${name} has been added to your emergency contacts.`, [
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]);
    } else {
      Alert.alert('Could Not Add Contact', result.error || 'An error occurred while saving.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Add Emergency Contact" showBack />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Device Phonebook Import Shortcut */}
        <Card style={styles.importCard} variant="flat">
          <View style={styles.importHeader}>
            <View style={styles.importIcon}>
              <Ionicons name="book-outline" size={24} color={colors.teal} />
            </View>
            <View style={styles.importTextCol}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                Select from Device Phonebook
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Quickly import contact name and phone number
              </Text>
            </View>
          </View>

          <Button
            title="Open Phonebook"
            variant="outline"
            size="small"
            loading={isPicking}
            onPress={handleDevicePick}
            style={styles.importBtn}
          />
        </Card>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR ENTER MANUALLY</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Manual Contact Form */}
        <Card style={styles.formCard} variant="elevated">
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contact Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Mom, Dr. Sharma, Jane"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. 9876543210 or +919876543210"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                returnKeyType="done"
              />
            </View>
            <Text style={styles.helperText}>
              Includes mobile numbers with or without country code (+91)
            </Text>
          </View>

          <Button
            title="Save Contact"
            variant="accent"
            size="large"
            loading={isSaving}
            onPress={handleSave}
            style={styles.saveBtn}
          />
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
  },
  importCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.tealMuted,
  },
  importHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  importIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  importTextCol: {
    flex: 1,
  },
  importBtn: {
    backgroundColor: '#FFFFFF',
    marginTop: spacing.xs,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.captionBold,
    color: colors.textMuted,
    paddingHorizontal: spacing.sm,
    letterSpacing: 1,
  },
  formCard: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    height: 50,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  saveBtn: {
    marginTop: spacing.md,
  },
});
