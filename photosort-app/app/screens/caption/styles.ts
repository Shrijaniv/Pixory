import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../lib/theme';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  back: { fontSize: 30, color: Colors.text, lineHeight: 32 },
  title: { ...Typography.title, color: Colors.text },
  next: { ...Typography.titleSm, color: Colors.accentText },

  // Live IG preview
  preview: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.line,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pvAvatarRing: { width: 26, height: 26, borderRadius: 13, padding: 2 },
  pvAvatarInner: { flex: 1, borderRadius: 11, backgroundColor: Colors.elevated },
  pvHandle: { ...Typography.titleSm, fontSize: 12, color: Colors.text, flex: 1 },
  pvDots: { color: Colors.text, fontSize: 16 },

  pvImageSlot: { width: '100%', height: 188, backgroundColor: Colors.elevated },
  pvImage: { width: '100%', height: '100%' },
  pvCountBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pvCountText: { ...Typography.mono, color: '#FFF', fontSize: 10 },
  pvDotsRow: {
    position: 'absolute',
    bottom: Spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  pvDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.4)' },
  pvDotActive: { backgroundColor: '#FFF' },

  pvActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  pvActionIcon: { fontSize: 18, color: Colors.text },
  pvCaption: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  pvCaptionText: { ...Typography.bodySm, color: Colors.textMuted, lineHeight: 18 },
  pvCaptionHandle: { color: Colors.text, fontFamily: 'SchibstedGrotesk_700Bold' },

  // Chips
  chipRow: { gap: Spacing.sm, paddingVertical: 2 },

  // Editor
  editor: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  editorInput: {
    ...Typography.bodyLg,
    color: Colors.text,
    minHeight: 90,
  },
  hashtags: { ...Typography.bodyMd, color: Colors.hashtag },

  // Location
  location: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.bodyMd,
    color: Colors.text,
  },
});
