/**
 * ScreenHeader — top navigation bar (dark). Back chevron, centered title,
 * optional right element. Transparent over the page background.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '../../lib/theme';

interface Props {
  title?: string;
  /** If omitted, back button is hidden. */
  onBack?: () => void;
  /** Arbitrary element placed on the right side (icon, avatar, action). */
  rightElement?: React.ReactNode;
}

export default function ScreenHeader({ title, onBack, rightElement }: Props) {
  const insets = useSafeAreaInsets();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.side}>
        {onBack !== undefined && (
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={10}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title ?? ''}
      </Text>

      <View style={[styles.side, styles.sideRight]}>{rightElement ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  side: {
    minWidth: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  backBtn: {
    padding: Spacing.xs,
  },
  backIcon: {
    fontSize: 30,
    lineHeight: 34,
    color: Colors.text,
    fontWeight: '300',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...Typography.title,
    color: Colors.text,
  },
});
