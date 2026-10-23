import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../src/theme';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { StatusBadge } from '../../src/components/StatusBadge';
import {
  loadAppSettings,
  saveShakeSettings,
  saveBackendUrl,
  savePrimaryEmergencyNumber,
  validateBackendUrl,
  testBackendConnection,
  getDeviceId,
  DEFAULT_BACKEND_URL,
} from '../../src/features/settings/settingsService';
import {
  fetchSmsDiagnostics,
  SmsDiagnosticsResult,
} from '../../src/features/alerts/alertService';

export default function SettingsScreen() {
  const router = useRouter();
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const [shakeSensitivity, setShakeSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const [backendUrl, setBackendUrlState] = useState('');
  const [primaryEmergencyNumber, setPrimaryNumberState] = useState('112');
  const [deviceId, setDeviceId] = useState('');
  const [customMsg, setCustomMsg] = useState('');

  // Connection testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    latencyMs?: number;
    message?: string;
  }>({ tested: false, success: false });

  // Advanced section collapse state
  const [showAdvancedServer, setShowAdvancedServer] = useState(false);
  const [isCheckingSms, setIsCheckingSms] = useState(false);
  const [smsDiagResult, setSmsDiagResult] = useState<SmsDiagnosticsResult | null>(null);

  useEffect(() => {
    const s = loadAppSettings();
    setShakeEnabled(s.shakeEnabled);
    setShakeSensitivity(s.shakeSensitivity);
    setBackendUrlState(s.backendUrl);
    setCustomMsg(s.customMessage);
    setPrimaryNumberState(s.primaryEmergencyNumber || '112');

    getDeviceId().then(setDeviceId);
  }, []);

  const handleToggleShake = (value: boolean) => {
    setShakeEnabled(value);
    saveShakeSettings(value, shakeSensitivity);
  };

  const handleSelectSensitivity = (level: 'low' | 'medium' | 'high') => {
    setShakeSensitivity(level);
    saveShakeSettings(shakeEnabled, level);
  };

  const handleSavePrimaryNumber = () => {
    const clean = primaryEmergencyNumber.trim();
    if (!clean) {
      Alert.alert('Error', 'Primary emergency number cannot be empty.');
      return;
    }
    savePrimaryEmergencyNumber(clean);
    Alert.alert('Saved', `Primary emergency calling line set to ${clean}.`);
  };

  const handleSaveBackendUrl = () => {
    const res = saveBackendUrl(backendUrl);
    if (!res.success) {
      Alert.alert('Invalid URL', res.error || 'Please enter a valid HTTP/HTTPS URL.');
      return;
    }
    setBackendUrlState(res.normalizedUrl);
    Alert.alert('Saved', `Backend server URL updated to:\n${res.normalizedUrl}`);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult({ tested: false, success: false });

    const res = await testBackendConnection(backendUrl);
    setIsTesting(false);

    if (res.success) {
      setTestResult({
        tested: true,
        success: true,
        latencyMs: res.latencyMs,
        message: res.statusText || 'Connected successfully',
      });
    } else {
      setTestResult({
        tested: true,
        success: false,
        latencyMs: res.latencyMs,
        message: res.error || 'Server unreachable',
      });
    }
  };

  const handleCheckSmsDiagnostics = async () => {
    setIsCheckingSms(true);
    setSmsDiagResult(null);
    const result = await fetchSmsDiagnostics();
    setIsCheckingSms(false);
    setSmsDiagResult(result);
  };

  const applyPresetUrl = (preset: string) => {
    setBackendUrlState(preset);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="App Settings & Safety" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section 1: Shake Detection Sensor */}
        <Text style={styles.sectionHeader}>ACCELEROMETER SHAKE SENSOR</Text>
        <Card style={styles.card} variant="elevated">
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[typography.bodyBold, styles.settingTitle]}>
                Enable Shake Trigger
              </Text>
              <Text style={[typography.caption, styles.settingDesc]}>
                Firmly shake the phone to activate 3-second emergency countdown
              </Text>
            </View>
            <Switch
              value={shakeEnabled}
              onValueChange={handleToggleShake}
              trackColor={{ false: colors.borderDark, true: colors.tealLight }}
              thumbColor={shakeEnabled ? colors.teal : '#FFFFFF'}
            />
          </View>

          {shakeEnabled && (
            <View style={styles.sensitivitySection}>
              <Text style={[typography.captionBold, styles.sensitivityLabel]}>
                SHAKE SENSITIVITY
              </Text>
              <View style={styles.sensitivityButtons}>
                {(['low', 'medium', 'high'] as const).map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[
                      styles.sensitivityPill,
                      shakeSensitivity === lvl && styles.sensitivityPillActive,
                    ]}
                    onPress={() => handleSelectSensitivity(lvl)}
                  >
                    <Text
                      style={[
                        styles.sensitivityPillText,
                        shakeSensitivity === lvl && styles.sensitivityTextActive,
                      ]}
                    >
                      {lvl.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.noticeText}>
              Shake monitoring operates reliably while the app is in the foreground. Never relies on dangerous background battery-draining hacks.
            </Text>
          </View>
        </Card>

        {/* Section 2: Custom Emergency Message */}
        <Text style={styles.sectionHeader}>SOS MESSAGE CONFIGURATION</Text>
        <Card
          style={styles.card}
          onPress={() => router.push('/settings/message')}
          variant="elevated"
        >
          <View style={styles.menuRow}>
            <View style={styles.menuIcon}>
              <Ionicons name="chatbox-outline" size={22} color={colors.teal} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={[typography.bodyBold, styles.menuTitle]}>
                Emergency Message
              </Text>
              <Text style={[typography.caption, styles.menuSub]} numberOfLines={2}>
                "{customMsg}"
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </Card>

        {/* Section 3: Primary Emergency Calling Line */}
        <Text style={styles.sectionHeader}>PRIMARY EMERGENCY CALL LINE</Text>
        <Card style={styles.card} variant="elevated">
          <Text style={[typography.bodyBold, styles.settingTitle]}>
            Configurable Emergency Number
          </Text>
          <Text style={[typography.caption, styles.settingDesc]}>
            National standard helpline (112) or designated local emergency service.
          </Text>

          <View style={styles.urlInputRow}>
            <TextInput
              style={styles.urlInput}
              value={primaryEmergencyNumber}
              onChangeText={setPrimaryNumberState}
              placeholder="112"
              keyboardType="phone-pad"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.saveUrlBtn} onPress={handleSavePrimaryNumber}>
              <Text style={styles.saveUrlBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Section 4: Alert History */}
        <Text style={styles.sectionHeader}>ACTIVITY & LEDGER</Text>
        <Card
          style={styles.card}
          onPress={() => router.push('/settings/history')}
          variant="elevated"
        >
          <View style={styles.menuRow}>
            <View style={styles.menuIcon}>
              <Ionicons name="time-outline" size={22} color={colors.teal} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={[typography.bodyBold, styles.menuTitle]}>
                Alert History & Logs
              </Text>
              <Text style={[typography.caption, styles.menuSub]}>
                View past emergency dispatches and delivery statuses
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </Card>

        {/* Section 5: Safety Resources & Guides */}
        <Text style={styles.sectionHeader}>SAFETY RESOURCES</Text>
        <Card style={styles.card} variant="elevated">
          <TouchableOpacity
            style={styles.menuSubRow}
            onPress={() => router.push('/guides')}
          >
            <Ionicons name="medkit-outline" size={20} color={colors.teal} style={{ marginRight: 12 }} />
            <Text style={[typography.body, styles.linkText]}>First Aid Safety Guides</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.innerDivider} />

          <TouchableOpacity
            style={styles.menuSubRow}
            onPress={() => router.push('/instructions')}
          >
            <Ionicons name="book-outline" size={20} color={colors.teal} style={{ marginRight: 12 }} />
            <Text style={[typography.body, styles.linkText]}>User Manual & Instructions</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.innerDivider} />

          <TouchableOpacity
            style={styles.menuSubRow}
            onPress={() => router.push('/settings/permissions')}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.teal} style={{ marginRight: 12 }} />
            <Text style={[typography.body, styles.linkText]}>Permissions & Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Section 6: Backend Server & Developer Configuration */}
        <Text style={styles.sectionHeader}>DEVELOPER & SERVER SETTINGS</Text>
        <Card style={styles.card} variant="outlined">
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setShowAdvancedServer(!showAdvancedServer)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, styles.settingTitle]}>
                Backend Server Configuration
              </Text>
              <Text style={[typography.caption, styles.settingDesc]}>
                FastAPI gateway endpoint for Twilio SMS dispatch
              </Text>
            </View>
            <Ionicons
              name={showAdvancedServer ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {showAdvancedServer && (
            <View style={styles.advancedServerContent}>
              <View style={styles.instructionBox}>
                <Ionicons name="information-circle" size={16} color={colors.teal} />
                <Text style={styles.instructionText}>
                  Android Emulator connects via <Text style={{ fontWeight: '700' }}>10.0.2.2</Text>. Physical devices connected via Wi-Fi must use your computer's LAN IP (e.g. <Text style={{ fontWeight: '700' }}>http://192.168.1.xxx:8000/api/v1</Text>).
                </Text>
              </View>

              <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                SERVER URL
              </Text>
              <View style={styles.urlInputRow}>
                <TextInput
                  style={styles.urlInput}
                  value={backendUrl}
                  onChangeText={setBackendUrlState}
                  placeholder="http://10.0.2.2:8000/api/v1"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.saveUrlBtn} onPress={handleSaveBackendUrl}>
                  <Text style={styles.saveUrlBtnText}>Save</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Presets */}
              <View style={styles.presetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyPresetUrl('http://10.0.2.2:8000/api/v1')}
                >
                  <Text style={styles.presetChipText}>Emulator (10.0.2.2)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyPresetUrl('http://localhost:8000/api/v1')}
                >
                  <Text style={styles.presetChipText}>Localhost</Text>
                </TouchableOpacity>
              </View>

              {/* Test Connection Button & Status */}
              <View style={styles.testConnectionRow}>
                <Button
                  title={isTesting ? 'Testing Connection...' : 'Test Connection'}
                  variant="outline"
                  size="small"
                  loading={isTesting}
                  onPress={handleTestConnection}
                  style={{ flex: 1, marginRight: spacing.xs }}
                />
                <Button
                  title={isCheckingSms ? 'Inspecting...' : 'SMS Diagnostics'}
                  variant="ghost"
                  size="small"
                  loading={isCheckingSms}
                  onPress={handleCheckSmsDiagnostics}
                  style={{ flex: 1 }}
                />
              </View>

              {testResult.tested && (
                <View
                  style={[
                    styles.testStatusBox,
                    testResult.success ? styles.testSuccessBox : styles.testErrorBox,
                  ]}
                >
                  <Ionicons
                    name={testResult.success ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={testResult.success ? colors.tealDark : colors.emergencyDark}
                  />
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text
                      style={[
                        typography.captionBold,
                        { color: testResult.success ? colors.tealDark : colors.emergencyDark },
                      ]}
                    >
                      {testResult.success ? 'Operational' : 'Connection Failed'}
                      {testResult.latencyMs != null ? ` (${testResult.latencyMs} ms)` : ''}
                    </Text>
                    <Text
                      style={[
                        typography.caption,
                        { color: testResult.success ? colors.tealDark : colors.emergencyDark, fontSize: 11 },
                      ]}
                    >
                      {testResult.message}
                    </Text>
                  </View>
                </View>
              )}

              {smsDiagResult && (
                <View style={styles.smsDiagCard}>
                  <View style={styles.smsDiagHeader}>
                    <Ionicons
                      name={
                        smsDiagResult.configurationStatus === 'live_ready'
                          ? 'shield-checkmark'
                          : smsDiagResult.configurationStatus === 'mock_mode'
                          ? 'flask'
                          : 'alert-circle'
                      }
                      size={18}
                      color={
                        smsDiagResult.configurationStatus === 'live_ready'
                          ? colors.tealDark
                          : '#B45309'
                      }
                    />
                    <Text
                      style={[
                        typography.captionBold,
                        {
                          marginLeft: 6,
                          color:
                            smsDiagResult.configurationStatus === 'live_ready'
                              ? colors.tealDark
                              : '#B45309',
                        },
                      ]}
                    >
                      {smsDiagResult.configurationStatus === 'live_ready'
                        ? 'Twilio Live Mode Ready'
                        : smsDiagResult.configurationStatus === 'mock_mode'
                        ? 'Mock Provider Mode Active'
                        : 'SMS Gateway Unconfigured'}
                    </Text>
                  </View>

                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 16 }]}>
                    {smsDiagResult.guidance || smsDiagResult.error}
                  </Text>

                  {smsDiagResult.maskedFromNumber ? (
                    <Text style={[typography.caption, { color: colors.textPrimary, marginTop: 4 }]}>
                      Configured Sender Number: <Text style={{ fontFamily: 'monospace' }}>{smsDiagResult.maskedFromNumber}</Text>
                    </Text>
                  ) : null}

                  {smsDiagResult.lastDispatch ? (
                    <View style={styles.lastDispatchBox}>
                      <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                        Last Backend Dispatch Status: {smsDiagResult.lastDispatch.status}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        Contacts: {smsDiagResult.lastDispatch.recipientCount} | Created:{' '}
                        {smsDiagResult.lastDispatch.createdAt
                          ? new Date(smsDiagResult.lastDispatch.createdAt).toLocaleTimeString()
                          : 'N/A'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              <Text style={[typography.caption, styles.deviceIdText]}>
                Device UUID: {deviceId || 'Loading...'}
              </Text>
            </View>
          )}
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ResQHub v1.0.0 (Safety Edition)</Text>
          <Text style={styles.footerSubText}>Designed for reliability, privacy, and rapid response</Text>
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
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    ...typography.captionBold,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    color: colors.textPrimary,
  },
  settingDesc: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  sensitivitySection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sensitivityLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sensitivityButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sensitivityPill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  sensitivityPillActive: {
    backgroundColor: colors.tealMuted,
    borderColor: colors.teal,
  },
  sensitivityPillText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  sensitivityTextActive: {
    color: colors.tealDark,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.sm,
    borderRadius: spacing.borderRadius.sm,
    marginTop: spacing.md,
  },
  noticeText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.tealMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  menuTitle: {
    color: colors.textPrimary,
  },
  menuSub: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  linkText: {
    color: colors.textPrimary,
    flex: 1,
  },
  innerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  advancedServerContent: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  instructionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.tealMuted,
    padding: spacing.sm,
    borderRadius: spacing.borderRadius.sm,
    marginBottom: spacing.xs,
  },
  instructionText: {
    ...typography.caption,
    color: colors.tealDark,
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  urlInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadius.md,
    paddingHorizontal: spacing.sm,
    height: 42,
    ...typography.caption,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  saveUrlBtn: {
    backgroundColor: colors.teal,
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: spacing.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveUrlBtnText: {
    ...typography.buttonSmall,
    color: '#FFFFFF',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  presetChip: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  testConnectionRow: {
    marginTop: spacing.sm,
  },
  testStatusBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: spacing.borderRadius.sm,
    marginTop: spacing.xs,
  },
  testSuccessBox: {
    backgroundColor: colors.tealMuted,
    borderWidth: 1,
    borderColor: colors.tealLight,
  },
  testErrorBox: {
    backgroundColor: colors.emergencyMuted,
    borderWidth: 1,
    borderColor: colors.emergencyLight,
  },
  smsDiagCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  smsDiagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastDispatchBox: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  deviceIdText: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: 11,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  footerText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  footerSubText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
