/**
 * RadioCard — tappable selection card with a radio dot, label, and optional sublabel.
 * Used for method picker (Classic/Claude/GPT-4o) and persona picker.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';

interface Props {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
}

export default function RadioCard({ label, sublabel, selected, onPress }: Props) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardActive]}
      onPress={onPress}
    >
      {/* Radio dot */}
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected && <View style={styles.radioDot} />}
      </View>

      {/* Text */}
      <View style={styles.textWrap}>
        <Text style={[styles.label, selected && styles.labelActive]}>{label}</Text>
        {sublabel ? (
          <Text style={styles.sublabel}>{sublabel}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  cardActive: {
    borderColor: Colors.accentSolid,
    backgroundColor: Colors.accentWash,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioActive: {
    borderColor: Colors.accentSolid,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accentSolid,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    ...Typography.titleSm,
    color: Colors.text,
  },
  labelActive: {
    color: Colors.accentText,
  },
  sublabel: {
    ...Typography.bodySm,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
