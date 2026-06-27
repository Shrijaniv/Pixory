/**
 * Toast — brief feedback message that appears at the bottom of the screen.
 * Auto-hides shortly after `visible` becomes true.
 * Built on React Native's core Animated API (no native reanimated dependency).
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';

interface Props {
  message: string;
  visible: boolean;
}

export default function Toast({ message, visible }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
    }
  }, [visible, message]);

  return (
    <Animated.View
      style={[styles.toast, { bottom: insets.bottom + Spacing.xl, opacity }]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  text: {
    ...Typography.bodySm,
    color: '#FFF',
  },
});
