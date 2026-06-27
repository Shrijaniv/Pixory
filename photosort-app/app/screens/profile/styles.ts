import { Dimensions, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../lib/theme';

const SCREEN_W = Dimensions.get('window').width;
const GRID_GAP = Spacing.sm;
export const TILE = (SCREEN_W - Spacing.xl * 2 - GRID_GAP * 2) / 3;

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  headerTitle: { ...Typography.title, color: Colors.text },
  gear: { fontSize: 18, color: Colors.textMuted },

  // Identity
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  avatarRing: {
    width: 60, height: 60, borderRadius: 30, padding: 2.5, backgroundColor: Colors.accentSolid,
  },
  avatar: { flex: 1, borderRadius: 28, backgroundColor: Colors.elevated },
  avatarInitials: {
    flex: 1, borderRadius: 28, backgroundColor: Colors.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitialsText: { ...Typography.title, color: Colors.text },
  name: { ...Typography.title, color: Colors.text },
  handle: { ...Typography.bodyMd, color: Colors.textFaint, marginTop: 2 },

  // Stats strip
  stats: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.tile,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.line },
  statNum: { ...Typography.title, color: Colors.text },
  statLabel: { ...Typography.bodySm, color: Colors.textFaint, marginTop: 2 },

  // Tabs
  tabs: { flexDirection: 'row', gap: Spacing.xl, marginBottom: Spacing.lg },
  tabLabel: { ...Typography.titleSm, color: Colors.textDim },
  tabLabelActive: { color: Colors.text },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: { width: TILE, height: TILE, borderRadius: Radius.sm, backgroundColor: Colors.elevated },
  emptyGrid: { ...Typography.bodyMd, color: Colors.textFaint, paddingVertical: Spacing.xxl, textAlign: 'center', width: '100%' },

  // Settings rows
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  settingIcon: { fontSize: 18, width: 22, textAlign: 'center' },
  settingTitle: { ...Typography.titleSm, color: Colors.text },
  settingSub: { ...Typography.bodySm, color: Colors.textFaint, marginTop: 1 },
  chevron: { fontSize: 20, color: Colors.textDim },
  signOut: { ...Typography.titleSm, color: Colors.error, textAlign: 'center', paddingVertical: Spacing.lg },

  // Persona picker sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    maxHeight: '80%',
  },
  sheetTitle: { ...Typography.title, color: Colors.text, marginBottom: Spacing.lg },
  personaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    marginBottom: Spacing.sm,
  },
  personaOptionActive: {
    borderColor: Colors.accentSolid,
    backgroundColor: Colors.accentWash,
  },
  personaOptionName: { ...Typography.titleSm, color: Colors.text },
  personaOptionDesc: { ...Typography.bodySm, color: Colors.textMuted, marginTop: 2, lineHeight: 17 },
  personaCheck: { color: Colors.accentSolid, fontSize: 18 },
});
