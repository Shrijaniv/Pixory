import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../lib/theme';

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  wordmark: {
    ...Typography.displayLg,
    fontSize: 26,
  },
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    padding: 2,
    backgroundColor: Colors.accentSolid,
  },
  avatar: {
    flex: 1,
    borderRadius: 17,
    backgroundColor: Colors.elevated,
  },
  avatarInitials: {
    flex: 1,
    borderRadius: 17,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    ...Typography.titleSm,
    color: Colors.text,
  },

  // Hero card
  hero: {
    borderRadius: Radius.sheet,
    padding: Spacing.xl,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  heroCircle: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroTitle: {
    ...Typography.title,
    fontSize: 19,
    color: '#FFF',
    fontFamily: 'SchibstedGrotesk_800ExtraBold',
  },
  heroSub: {
    ...Typography.bodyMd,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 6,
    maxWidth: 190,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    borderRadius: Radius.full,
    paddingVertical: 9,
    paddingHorizontal: 15,
    marginTop: Spacing.lg,
  },
  heroPillText: {
    ...Typography.titleSm,
    fontSize: 12,
    color: Colors.heroPillText,
  },

  // Stories list
  sectionLabel: {
    ...Typography.labelMono,
    color: Colors.textFaint,
    marginBottom: Spacing.md,
  },
  storyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: Radius.input,
    backgroundColor: Colors.elevated,
  },
  storyTitle: {
    ...Typography.titleSm,
    color: Colors.text,
  },
  storyMeta: {
    ...Typography.bodySm,
    color: Colors.textFaint,
    marginTop: 2,
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.titleSm,
    color: Colors.textMuted,
  },
  emptySub: {
    ...Typography.bodySm,
    color: Colors.textFaint,
    textAlign: 'center',
    maxWidth: 220,
  },
});
