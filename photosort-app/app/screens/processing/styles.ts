import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../lib/theme';

const RING = 150;
const HOLE = 128;

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  cancel: { ...Typography.bodyLg, color: Colors.textMuted },
  headerTitle: { ...Typography.title, color: Colors.text },

  loaderSection: { alignItems: 'center', paddingTop: Spacing.xxl, paddingBottom: Spacing.xl, gap: Spacing.md },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ring: { width: RING, height: RING, borderRadius: RING / 2, overflow: 'hidden' },
  ringGradient: { flex: 1 },
  ringHole: {
    position: 'absolute',
    width: HOLE,
    height: HOLE,
    borderRadius: HOLE / 2,
    backgroundColor: Colors.bg,
  },
  ringCenter: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end' },
  pct: { ...Typography.displayLg, fontSize: 34, color: Colors.text },
  pctSign: { ...Typography.title, color: Colors.textMuted, marginBottom: 4 },

  heading: { ...Typography.title, color: Colors.text, marginTop: Spacing.lg },
  subtitle: { ...Typography.bodyMd, color: Colors.textFaint, textAlign: 'center', maxWidth: 280 },

  staleBox: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    backgroundColor: Colors.draftWash,
    borderWidth: 1,
    borderColor: Colors.draft,
    gap: Spacing.sm,
  },
  staleTitle: { ...Typography.title, fontSize: 15, color: Colors.draft },
  staleMsg: { ...Typography.bodyMd, color: Colors.textMuted, lineHeight: 19 },
  errorBox: {
    margin: Spacing.xl,
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.lineMid,
  },
  errorTitle: { ...Typography.title, color: Colors.text },
  errorMsg: { ...Typography.bodyMd, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },

  stepsScroll: { flex: 1 },
  stepsContent: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, gap: Spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  stepDotDone: { backgroundColor: Colors.accentSolid, borderColor: Colors.accentSolid },
  stepDotCurrent: { borderColor: Colors.accentSolid },
  stepCheck: { color: '#FFF', fontSize: 10, fontWeight: '700', lineHeight: 14 },
  stepText: { ...Typography.bodyMd, color: Colors.textFaint, flex: 1, lineHeight: 20 },
  stepTextDone: { color: Colors.textDim },
  stepTextCurrent: { color: Colors.text, fontFamily: 'SchibstedGrotesk_600SemiBold' },
});
