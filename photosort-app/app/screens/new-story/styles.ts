import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../../lib/theme';

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  label: {
    ...Typography.labelMono,
    color: Colors.textFaint,
    marginBottom: Spacing.sm,
  },

  // Story textarea (hero field)
  textarea: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    minHeight: 96,
    ...Typography.bodyLg,
    color: Colors.text,
    textAlignVertical: 'top',
  },

  // Dates + Place pills
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pill: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 3,
  },
  pillLabel: {
    ...Typography.labelMono,
    fontSize: 9,
    color: Colors.textFaint,
  },
  pillValue: {
    ...Typography.titleSm,
    color: Colors.text,
  },
  pillValueMuted: {
    color: Colors.textFaint,
  },

  // Persona chips
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },

  // Persona live description panel
  descPanel: {
    marginTop: Spacing.md,
    backgroundColor: Colors.accentWash,
    borderWidth: 1,
    borderColor: Colors.accentWashBorder,
    borderRadius: Radius.tile,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  descIcon: {
    fontSize: 14,
    color: Colors.accentText,
    marginTop: 1,
  },
  descText: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.textMuted,
    lineHeight: 19,
  },
  descName: {
    color: Colors.text,
    fontFamily: 'SchibstedGrotesk_700Bold',
  },

  // Curation engine segmented control
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    borderRadius: Radius.input,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.tile,
  },
  segmentItemActive: {
    backgroundColor: Colors.accentSolid,
  },
  segmentText: {
    ...Typography.titleSm,
    color: Colors.textMuted,
  },
  segmentTextActive: {
    color: '#FFF',
  },

  // My-face filter row
  faceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  faceIcon: {
    fontSize: 20,
  },
  faceTitle: {
    ...Typography.titleSm,
    color: Colors.text,
  },
  faceSub: {
    ...Typography.bodySm,
    color: Colors.textFaint,
    marginTop: 1,
  },
  faceSubAccent: {
    color: Colors.accentText,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
});
