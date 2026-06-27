import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../lib/theme';
import { SCREEN_W } from './types';

const HERO_H = 250;
const FILM_THUMB = 58;

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  close: { fontSize: 20, color: Colors.text },
  title: { ...Typography.title, color: Colors.text },
  countPill: {
    minWidth: 34,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: { ...Typography.titleSm, color: '#FFF' },

  // Story banner
  storyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    backgroundColor: Colors.accentWash,
    borderWidth: 1,
    borderColor: Colors.accentWashBorder,
    borderRadius: Radius.tile,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  storyIcon: { fontSize: 14 },
  storyText: { flex: 1, ...Typography.bodySm, color: Colors.textMuted },

  // Focused hero
  heroWrap: {
    marginHorizontal: Spacing.xl,
    height: HERO_H,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Colors.elevated,
  },
  hero: { width: '100%', height: '100%' },
  orderBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: { ...Typography.titleSm, color: '#FFF', fontFamily: 'SchibstedGrotesk_800ExtraBold' },
  heroTopRight: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    gap: Spacing.sm,
  },
  heroIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIcon: { color: '#FFF', fontSize: 15 },
  removeIcon: { color: '#FFF', fontSize: 14 },
  roleChip: {
    position: 'absolute',
    left: Spacing.md,
    bottom: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roleChipText: { ...Typography.bodySm, color: '#FFF', fontFamily: 'SchibstedGrotesk_600SemiBold' },
  moveRow: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  moveBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnDisabled: { opacity: 0.3 },
  moveIcon: { color: '#FFF', fontSize: 18, lineHeight: 20 },

  // Filmstrip
  hint: { ...Typography.bodySm, color: Colors.textFaint, textAlign: 'center', marginVertical: Spacing.md },
  filmstrip: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  thumbWrap: {
    width: FILM_THUMB,
    height: FILM_THUMB,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: { borderColor: Colors.accentSolid },
  thumb: { width: '100%', height: '100%' },

  // More matches tray
  traySection: { marginTop: Spacing.xl },
  trayLabel: {
    ...Typography.labelMono,
    color: Colors.textFaint,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  trayRow: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  trayCell: {
    width: 50,
    height: 50,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.elevated,
  },
  trayImage: { width: '100%', height: '100%' },
  addBtn: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: { color: '#FFF', fontSize: 12, lineHeight: 14 },
  heartBadge: {
    position: 'absolute',
    left: 2,
    top: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartText: { color: '#FF5A6E', fontSize: 9 },
  libraryCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.lineMid,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  libraryIcon: { color: Colors.textMuted, fontSize: 16, lineHeight: 18 },
  libraryText: { ...Typography.bodySm, color: Colors.textFaint, fontSize: 8 },

  // Footer
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  nextBtn: { borderRadius: Radius.lg, overflow: 'hidden' },
  nextBtnDisabled: { opacity: 0.4 },
  nextGradient: { paddingVertical: 15, alignItems: 'center', borderRadius: Radius.lg },
  nextText: { ...Typography.titleSm, color: '#FFF' },

  // Warn + toast
  warnBanner: {
    position: 'absolute',
    bottom: 90,
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: Colors.error,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  warnText: { ...Typography.bodySm, color: '#FFF', textAlign: 'center' },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: Colors.elevated,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  toastText: { ...Typography.bodySm, color: Colors.text },

  // Viewer
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: SCREEN_W, height: '80%' },
  viewerClose: { position: 'absolute', top: 60, right: Spacing.xl, color: '#FFF', fontSize: 24 },
});
