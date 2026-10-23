import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../src/theme';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import {
  loadAppSettings,
  saveCustomMessage,
  resetCustomMessage,
  DEFAULT_MESSAGE,
} from '../../src/features/settings/settingsService';

export default function EditMessageScreen() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const s = loadAppSettings();
    setMessage(s.customMessage);
  }, []);

  const handleSave = () => {
    if (!message.trim()) {
      Alert.alert('Empty Message', 'Emergency message cannot be empty.');
      return;
    }
    setIsSaving(true);
    saveCustomMessage(message);
    setIsSaving(false);
    Alert.alert('Saved', 'Your emergency message has been updated successfully.', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Message',
      'Reset the emergency message back to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset to Default',
          style: 'destructive',
          onPress: () => {
            const def = resetCustomMessage();
            setMessage(def);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Emergency Message" showBack />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card} variant="elevated">
          <Text style={[typography.bodyBold, styles.title]}>
            Customize SOS Message
          </Text>
          <Text style={[typography.caption, styles.subtitle]}>
            This text will be sent to each of your emergency contacts when SOS is triggered, alongside your real-time coordinates.
          </Text>

          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={4}
            value={message}
            onChangeText={setMessage}
            placeholder="Enter your emergency message..."
            placeholderTextColor={colors.textMuted}
            maxLength={300}
          />

          <View style={styles.charCountRow}>
            <Text style={styles.charCount}>{message.length} / 300 characters</Text>
          </View>
        </Card>

        {/* Live Message Preview Card */}
        <Card style={styles.previewCard} variant="flat">
          <Text style={[typography.captionBold, styles.previewHeader]}>
            SMS DISPATCH PREVIEW
          </Text>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              🚨 EMERGENCY (ResQHub){'\n'}
              Hey [Contact Name],{'\n'}
              {message.trim() || DEFAULT_MESSAGE}
              {'\n\n'}
              Location: https://maps.google.com/maps?q=19.0760,72.8777
            </Text>
          </View>
        </Card>

        <View style={styles.buttonRow}>
          <Button
            title="Reset to Default"
            variant="outline"
            onPress={handleReset}
            style={styles.actionBtn}
          />
          <Button
            title="Save Message"
            variant="accent"
            loading={isSaving}
            onPress={handleSave}
            style={styles.actionBtn}
          />
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
  content: {
    padding: spacing.gutter,
  },
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 110,
    textAlignVertical: 'top',
    backgroundColor: colors.surface,
  },
  charCountRow: {
    alignItems: 'flex-end',
    marginTop: spacing.xs,
  },
  charCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  previewCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  previewHeader: {
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  bubble: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
