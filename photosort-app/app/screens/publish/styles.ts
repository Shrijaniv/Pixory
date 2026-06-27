import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../lib/theme';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: Spacing.xl, gap: Spacing.lg },

  // Confirm strip
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.card,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  coverWrap: { position: 'relative' },
  cover: { width: 62, height: 62, borderRadius: Radius.tile, backgroundColor: Colors.elevated },
  coverBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accentSolid,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  coverBadgeText: { ...Typography.mono, color: '#FFF', fontSize: 10 },
  confirmTitle: { ...Typography.titleSm, color: Colors.text },
  confirmMeta: { ...Typography.bodySm, color: Colors.textFaint, marginTop: 2 },
  confirmReady: { ...Typography.bodySm, color: Colors.success, marginTop: 2 },

  // Action 1 (Instagram)
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    shadowColor: Colors.accentGlow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  actionIcon: { fontSize: 22, color: '#FFF' },
  actionPrimaryTitle: { ...Typography.title, fontSize: 16, color: '#FFF' },
  actionPrimarySub: { ...Typography.bodySm, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  actionChevron: { fontSize: 22, color: '#FFF' },

  // Action 2 (Save)
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lineMid,
  },
  actionIconDark: { fontSize: 22, color: Colors.text },
  actionSecondaryTitle: { ...Typography.title, fontSize: 16, color: Colors.text },
  actionSecondarySub: { ...Typography.bodySm, color: Colors.textFaint, marginTop: 2 },
  actionChevronDark: { fontSize: 22, color: Colors.textDim },

  status: { ...Typography.bodySm, color: Colors.textMuted, textAlign: 'center' },

  // Privacy
  privacy: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.tile,
    padding: Spacing.lg,
  },
  privacyText: { ...Typography.bodySm, color: Colors.textMuted, lineHeight: 18 },
});
