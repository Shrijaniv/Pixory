/**
 * Chip — pill selector used for personas, caption styles, profile tabs.
 * Inactive = transparent + lineStrong border + textMuted.
 * Active = amber→coral gradient fill + white.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Colors, Gradients, Radius, Typography } from '../../lib/theme';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
}

export default function Chip({ label, active, onPress }: Props) {
  if (active) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <LinearGradient
          colors={Gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.chip}
        >
          <Text style={[styles.label, styles.labelActive]}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, styles.inactive, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.lineStrong,
  },
  label: {
    ...Typography.bodyLg,
    color: Colors.textMuted,
  },
  labelActive: {
    color: '#FFF',
    fontFamily: 'SchibstedGrotesk_700Bold',
  },
});
