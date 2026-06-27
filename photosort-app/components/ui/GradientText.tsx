/**
 * GradientText — accent-colored text (wordmark, active tab labels).
 * Uses a solid accent fill rather than a masked gradient so it needs no
 * native MaskedView module (keeps the app runnable on any binary).
 */
import { StyleProp, Text, TextStyle } from 'react-native';
import { Colors } from '../../lib/theme';

interface Props {
  children: string;
  style?: StyleProp<TextStyle>;
  /** Accepted for API compatibility; the first stop is used as the solid color. */
  colors?: readonly [string, string, ...string[]];
}

export default function GradientText({ children, style, colors }: Props) {
  const color = colors?.[0] ?? Colors.accentSolid;
  return <Text style={[style, { color }]}>{children}</Text>;
}
