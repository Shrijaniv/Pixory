/**
 * Badge — small pill shown on photo cells.
 * Used for story role labels (HOOK/WORLD/etc.) and order numbers.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';
import type { StoryRole } from '../../lib/store';

const ROLE_BG: Record<StoryRole, string> = {
  hook:    Colors.roleHook,
  world:   Colors.roleWorld,
  life:    Colors.roleLife,
  detail:  Colors.roleDetail,
  closer:  Colors.roleCloser,
};

interface Props {
  /** If provided, renders a colored role label. */
  role?: StoryRole;
  /** If provided, renders a numbered order badge. */
  order?: number;
}

export default function Badge({ role, order }: Props) {
  if (role) {
    return (
      <View style={[styles.pill, { backgroundColor: ROLE_BG[role] }]}>
        <Text style={styles.pillText}>{role.toUpperCase()}</Text>
      </View>
    );
  }

  if (order !== undefined) {
    return (
      <View style={styles.orderBadge}>
        <Text style={styles.orderText}>{order}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  pillText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  orderBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    ...Typography.bodySm,
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
