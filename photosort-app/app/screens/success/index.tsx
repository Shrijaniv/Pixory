import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../../components/ui';
import { Colors, Gradients, Spacing, Typography } from '../../../lib/theme';

export default function SuccessScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isSave = mode === 'save';

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <LinearGradient
          colors={Gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.check}
        >
          <Text style={styles.checkMark}>✓</Text>
        </LinearGradient>
        <Text style={styles.title}>All done</Text>
        <Text style={styles.body}>
          {isSave
            ? 'Your carousel is saved to a Pixory album in Photos, and the caption’s on your clipboard.'
            : 'Your carousel is live and the caption’s on your clipboard. Nicely curated.'}
        </Text>
      </View>
      <View style={styles.footer}>
        <PrimaryButton label="Back to home" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  center: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  check: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accentGlow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 10,
  },
  checkMark: {
    fontSize: 44,
    color: '#FFF',
    lineHeight: 50,
  },
  title: {
    ...Typography.displayLg,
    fontSize: 22,
    color: Colors.text,
  },
  body: {
    ...Typography.bodyMd,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    bottom: 60,
  },
});
