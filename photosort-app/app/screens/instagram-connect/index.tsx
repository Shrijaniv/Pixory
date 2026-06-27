import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PrimaryButton, ScreenHeader } from '../../../components/ui';
import { Colors, Gradients, Radius, Spacing, Typography } from '../../../lib/theme';
import { usePublishState } from '../publish/hooks';

export default function InstagramConnectScreen() {
  const {
    igUsername,
    setIgUsername,
    igPassword,
    setIgPassword,
    igStatus,
    igMsg,
    igConnected,
    igBusy,
    handlePostToInstagram,
    handleDisconnect,
  } = usePublishState();

  const [reveal, setReveal] = useState(false);

  // Navigate to Success once the post completes
  useEffect(() => {
    if (igStatus === 'success') router.replace('/success?mode=publish');
  }, [igStatus]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Connect Instagram" onBack={() => router.back()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          {/* IG brand icon — the ONLY place the IG gradient appears */}
          <View style={styles.iconWrap}>
            <LinearGradient
              colors={Gradients.ig}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={styles.icon}
            >
              <Text style={styles.iconGlyph}>📷</Text>
            </LinearGradient>
          </View>

          <Text style={styles.title}>Link your account</Text>
          <Text style={styles.subtitle}>
            So Pixory can publish the carousel for you. You only do this once.
          </Text>

          {igConnected && igStatus !== 'posting' ? (
            <View style={styles.connectedCard}>
              <Text style={styles.connectedLabel}>Connected</Text>
              <Text style={styles.connectedHandle}>@{igUsername}</Text>
              <Pressable onPress={handleDisconnect} hitSlop={8}>
                <Text style={styles.disconnect}>Disconnect</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.at}>@</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Instagram username"
                  placeholderTextColor={Colors.textFaint}
                  value={igUsername}
                  onChangeText={setIgUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.field}>
                <TextInput
                  style={[styles.input, { paddingLeft: Spacing.lg }]}
                  placeholder="Password"
                  placeholderTextColor={Colors.textFaint}
                  value={igPassword}
                  onChangeText={setIgPassword}
                  secureTextEntry={!reveal}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setReveal((r) => !r)} hitSlop={8} style={styles.reveal}>
                  <Text style={styles.revealIcon}>{reveal ? '🙈' : '👁'}</Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={styles.privacy}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyText}>
              Stored only on this device in the iOS Secure Enclave — sent directly to Instagram,
              never to Pixory’s servers.
            </Text>
          </View>

          {igMsg ? <Text style={styles.msg}>{igMsg}</Text> : null}
        </View>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <PrimaryButton
          label={igConnected ? 'Publish now' : 'Connect & publish'}
          variant="gradient"
          loading={igBusy}
          onPress={handlePostToInstagram}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  body: { paddingHorizontal: Spacing.xl, alignItems: 'center', gap: Spacing.md },
  iconWrap: { marginTop: Spacing.xl, marginBottom: Spacing.sm },
  icon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 30 },
  title: { ...Typography.title, color: Colors.text },
  subtitle: {
    ...Typography.bodyMd,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: Spacing.md,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.lg,
  },
  at: { ...Typography.bodyLg, color: Colors.textFaint, marginRight: 6 },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    ...Typography.bodyLg,
    color: Colors.text,
  },
  reveal: { padding: Spacing.sm },
  revealIcon: { fontSize: 16 },
  connectedCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    borderRadius: Radius.input,
    paddingVertical: Spacing.lg,
  },
  connectedLabel: { ...Typography.labelMono, color: Colors.success },
  connectedHandle: { ...Typography.title, color: Colors.text },
  disconnect: { ...Typography.bodyMd, color: Colors.error, marginTop: 4 },
  privacy: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.tile,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  privacyIcon: { fontSize: 14 },
  privacyText: { flex: 1, ...Typography.bodySm, color: Colors.textMuted, lineHeight: 18 },
  msg: { ...Typography.bodySm, color: Colors.textMuted, textAlign: 'center' },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: 40, paddingTop: Spacing.md },
});
