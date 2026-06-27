/**
 * Toggle — 38×22 pill switch. On = amber→coral gradient; off = dark track.
 * Built on React Native's core Animated API (no native reanimated dependency).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Colors, Gradients } from '../../lib/theme';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

const TRACK_W = 38;
const TRACK_H = 22;
const THUMB = 18;
const TRAVEL = TRACK_W - THUMB - 4; // 2px padding each side

export default function Toggle({ value, onChange, disabled = false }: Props) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [value]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });

  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[styles.track, { opacity: disabled ? 0.4 : 1 }]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: progress, borderRadius: TRACK_H / 2, overflow: 'hidden' }]}
      >
        <LinearGradient
          colors={Gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: 2,
    justifyContent: 'center',
    backgroundColor: Colors.toggleOff,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFF',
  },
});
