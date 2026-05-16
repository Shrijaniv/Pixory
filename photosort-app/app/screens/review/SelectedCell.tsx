import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { styles } from './styles';
import { ROLE_COLORS, SelectedItem } from './types';

export function SelectedCell({ item, onDeselect, role }: {
  item: SelectedItem;
  onDeselect: (uri: string) => void;
  role?: string;
}) {
  return (
    <Pressable style={styles.cell} onPress={() => onDeselect(item.localUri)}>
      <Image source={{ uri: item.localUri }} style={styles.cellImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
      <View style={styles.selBadgeActive}><Text style={styles.selNum}>{item.order}</Text></View>
      {role ? (
        <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[role] ?? '#555' }]}>
          <Text style={styles.roleText}>{role.toUpperCase()}</Text>
        </View>
      ) : null}
      <View style={styles.deselHint}><Text style={styles.deselHintText}>✕</Text></View>
    </Pressable>
  );
}
