/**
 * TabBar — bottom navigation with 3 slots: Home ⌂ · center FAB ＋ · Profile ◔.
 * The FAB is lifted and routes to New Story. Active label is gradient-clipped.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resetStoryBrief } from '../../lib/store';
import { Colors, Gradients, Radius, Typography } from '../../lib/theme';
import GradientText from './GradientText';

interface Props {
  active: 'home' | 'profile';
}

export default function TabBar({ active }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 22 }]}>
      <Pressable style={styles.slot} onPress={() => router.replace('/')} hitSlop={8}>
        <Text style={[styles.icon, active === 'home' && styles.iconActive]}>⌂</Text>
        {active === 'home'
          ? <GradientText style={styles.label} colors={Gradients.accent}>Home</GradientText>
          : <Text style={[styles.label, styles.labelInactive]}>Home</Text>}
      </Pressable>

      <Pressable style={styles.fabSlot} onPress={() => { resetStoryBrief(); router.push('/new-story'); }}>
        <LinearGradient
          colors={Gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Text style={styles.fabIcon}>＋</Text>
        </LinearGradient>
      </Pressable>

      <Pressable style={styles.slot} onPress={() => router.replace('/profile')} hitSlop={8}>
        <Text style={[styles.icon, active === 'profile' && styles.iconActive]}>◔</Text>
        {active === 'profile'
          ? <GradientText style={styles.label} colors={Gradients.accent}>Profile</GradientText>
          : <Text style={[styles.label, styles.labelInactive]}>Profile</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    backgroundColor: Colors.bg,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
  },
  fab: {
    width: 46,
    height: 46,
    borderRadius: Radius.fab,
    marginTop: -8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accentGlow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 26,
    color: '#FFF',
    lineHeight: 30,
  },
  icon: {
    fontSize: 20,
    color: Colors.textDim,
  },
  iconActive: {
    color: Colors.accentSolid,
  },
  label: {
    ...Typography.labelMono,
    fontSize: 9,
    letterSpacing: 1,
  },
  labelInactive: {
    color: Colors.textDim,
  },
});
