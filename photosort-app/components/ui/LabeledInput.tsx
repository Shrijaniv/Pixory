/**
 * LabeledInput — TextInput with a label above and optional hint below.
 * Replaces the label + TextInput pattern repeated across screens.
 */
import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: ViewStyle;
}

export default function LabeledInput({
  label,
  value,
  onChangeText,
  hint,
  placeholder,
  multiline = false,
  numberOfLines = 1,
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  style,
}: Props) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textFaint}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : undefined}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.labelMono,
    color: Colors.textFaint,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.lineMid,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.bodyLg,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    ...Typography.bodySm,
    color: Colors.textFaint,
    marginTop: Spacing.xs,
  },
});
