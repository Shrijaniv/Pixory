/**
 * PrimaryButton — the main CTA button in three variants:
 *   solid    — filled primary blue
 *   gradient — brand gradient (magenta → blue)
 *   instagram — Instagram gradient
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'solid' | 'gradient' | 'instagram';
}

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'solid',
}: Props) {
  const isDisabled = disabled || loading;

  const inner = (
    <>
      {loading ? (
        <ActivityIndicator color="#FFF" size="small" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </>
  );

  if (variant === 'gradient') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={{ opacity: isDisabled ? 0.5 : 1 }}
      >
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.btn}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  if (variant === 'instagram') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={{ opacity: isDisabled ? 0.5 : 1 }}
      >
        <LinearGradient
          colors={Colors.igGradient as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.btn}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  // solid
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.btn, styles.solid, isDisabled && styles.disabled]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  solid: {
    backgroundColor: Colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...Typography.labelBold,
    color: '#FFF',
    fontSize: 16,
  },
});
