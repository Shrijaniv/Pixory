/**
 * PhotoCell — photo thumbnail with optional badge and overlay.
 * Used in review grid, caption strip, and publish carousel.
 */
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Badge from './Badge';
import type { StoryRole } from '../../lib/store';

interface Props {
  uri: string;
  size: number;
  onPress?: () => void;
  /** Story role badge (top-left). */
  role?: StoryRole;
  /** Order number badge (top-right). */
  order?: number;
  /** Overlay element rendered on top of the image. */
  overlay?: React.ReactNode;
  style?: ViewStyle;
}

export default function PhotoCell({ uri, size, onPress, role, order, overlay, style }: Props) {
  const cell = (
    <View style={[{ width: size, height: size }, style]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        recyclingKey={uri}
      />
      {role && (
        <View style={styles.topLeft}>
          <Badge role={role} />
        </View>
      )}
      {order !== undefined && (
        <View style={styles.topRight}>
          <Badge order={order} />
        </View>
      )}
      {overlay}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={{ width: size, height: size }}>
        {cell}
      </Pressable>
    );
  }

  return cell;
}

const styles = StyleSheet.create({
  topLeft: {
    position: 'absolute',
    top: 4,
    left: 4,
  },
  topRight: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
