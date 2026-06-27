/**
 * GlassCard — semi-transparent frosted card for use over dark or image backgrounds.
 */
import { BlurView } from 'expo-blur';
import { StyleSheet, ViewStyle } from 'react-native';
import { Radius } from '../../lib/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}

export default function GlassCard({ children, style, intensity = 40 }: Props) {
  return (
    <BlurView intensity={intensity} tint="light" style={[styles.card, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
