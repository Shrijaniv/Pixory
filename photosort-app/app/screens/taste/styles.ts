import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../lib/theme';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl, gap: Spacing.lg },

  // Narrative panel (the "magic")
  narrativeCard: {
    backgroundColor: Colors.accentWash,
    borderWidth: 1,
    borderColor: Colors.accentWashBorder,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  narrativeLabel: { ...Typography.labelMono, color: Colors.accentText },
  narrativeText: { ...Typography.bodyLg, color: Colors.text, lineHeight: 22 },

  // Section label
  label: { ...Typography.labelMono, color: Colors.textFaint, marginTop: Spacing.sm },

  // Trait bars
  trait: { gap: 6, marginBottom: Spacing.md },
  traitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  traitLabel: { ...Typography.titleSm, color: Colors.text },
  traitPct: { ...Typography.mono, color: Colors.textFaint, fontSize: 10 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.elevated,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barCenter: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: Colors.lineStrong },
  barFillPos: { position: 'absolute', left: '50%', top: 0, bottom: 0, backgroundColor: Colors.accentSolid, borderRadius: 4 },
  barFillNeg: { position: 'absolute', right: '50%', top: 0, bottom: 0, backgroundColor: Colors.textDim, borderRadius: 4 },

  // Stat row
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  statLabel: { ...Typography.bodyMd, color: Colors.textMuted },
  statValue: { ...Typography.titleSm, color: Colors.text },

  footnote: { ...Typography.bodySm, color: Colors.textFaint, textAlign: 'center', marginTop: Spacing.sm },

  // Empty state
  empty: { alignItems: 'center', paddingTop: Spacing.xxl, gap: Spacing.md },
  emptyGlyph: { fontSize: 40 },
  emptyTitle: { ...Typography.title, color: Colors.text },
  emptyBody: { ...Typography.bodyMd, color: Colors.textMuted, textAlign: 'center', maxWidth: 260, lineHeight: 20 },
  progressTrack: { width: 200, height: 6, borderRadius: 3, backgroundColor: Colors.elevated, overflow: 'hidden', marginTop: Spacing.sm },
  progressFill: { height: '100%', backgroundColor: Colors.accentSolid, borderRadius: 3 },
});
