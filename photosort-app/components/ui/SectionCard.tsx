/**
 * SectionCard — white card with a title, optional hint, and children.
 * Used to group related settings/controls on any screen.
 */
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';

interface Props {
  title: string;
  hint?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function SectionCard({ title, hint, children, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.line,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  title: {
    ...Typography.labelMono,
    color: Colors.textFaint,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  hint: {
    ...Typography.bodySm,
    color: Colors.textFaint,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
});
