/**
 * PrimaryButton — the main CTA. Variants:
 *   gradient     — amber→coral accent fill (default), glow shadow
 *   gradientHero — 3-stop hero gradient
 *   secondary    — surface bg + lineMid border
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Colors, Gradients, Radius, Spacing, Typography } from '../../lib/theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'gradient' | 'gradientHero' | 'secondary';
}

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'gradient',
}: Props) {
  const isDisabled = disabled || loading;

  const inner = loading ? (
    <ActivityIndicator color="#FFF" size="small" />
  ) : (
    <Text style={[styles.label, variant === 'secondary' && styles.labelSecondary]}>{label}</Text>
  );

  if (variant === 'secondary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.btn,
          styles.secondary,
          { opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  const colors = variant === 'gradientHero' ? Gradients.accentHero : Gradients.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.shadow, { opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1 }]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.btn}
      >
        {inner}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: Radius.lg,
    shadowColor: Colors.accentGlow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  btn: {
    minHeight: 50,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 15,
  },
  secondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lineMid,
  },
  label: {
    ...Typography.titleSm,
    color: '#FFF',
  },
  labelSecondary: {
    color: Colors.text,
  },
});
