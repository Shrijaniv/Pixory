import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../lib/theme';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    gap: Spacing.lg,
  },
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 66,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selfie: { width: '100%', height: '100%' },
  glyph: { fontSize: 56, color: Colors.textMuted },
  title: { ...Typography.title, fontSize: 19, color: Colors.text, marginTop: Spacing.sm },
  copy: {
    ...Typography.bodyMd,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 19,
  },
  privacy: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  privacyText: { ...Typography.bodySm, color: Colors.textMuted },
  error: { ...Typography.bodySm, color: Colors.error, textAlign: 'center' },
  clear: { ...Typography.bodyMd, color: Colors.error, marginTop: Spacing.sm },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    gap: Spacing.md,
    alignItems: 'center',
  },
  notNow: { ...Typography.bodyMd, color: Colors.textFaint },
});
