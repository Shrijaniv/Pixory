/**
 * ScreenHeader — top navigation bar used on every screen.
 * Provides a back button, title, and an optional right element.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '../../lib/theme';

interface Props {
  title: string;
  /** If omitted, back button is hidden. */
  onBack?: () => void;
  /** Arbitrary element placed on the right side (icon, avatar, etc.). */
  rightElement?: React.ReactNode;
}

export default function ScreenHeader({ title, onBack, rightElement }: Props) {
  const insets = useSafeAreaInsets();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}>
      {/* Left — back button or spacer */}
      <View style={styles.side}>
        {onBack !== undefined && (
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
        )}
      </View>

      {/* Center — title */}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {/* Right — optional element or spacer */}
      <View style={[styles.side, styles.sideRight]}>
        {rightElement ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  side: {
    width: 44,
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
    fontSize: 28,
    lineHeight: 32,
    color: Colors.primary,
    fontWeight: '300',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...Typography.displayMd,
    color: Colors.text,
  },
});
